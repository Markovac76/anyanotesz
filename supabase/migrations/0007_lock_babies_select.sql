-- ============================================================
-- Code-review javítások, 5. pont (+ 2. és 3. pont ide bundle-özve):
--
-- 1) Nickname egyediség case-insensitive indexszel (2. pont) — DB-szintű
--    védelem a versenyhelyzet ellen, amikor két user pár másodpercen belül
--    ugyanazzal a becenévvel regisztrál.
-- 2) Laza range-check-ek a numerikus mezőkön (3. pont) — nyilvánvalóan
--    hibás (negatív, irreálisan nagy) értékek kiszűrése DB-szinten.
-- 3) A "babies" tábla teljes soraihoz (beleértve a bizalmas születési
--    adatokat) mostantól KIZÁRÓLAG jóváhagyott tagok férnek hozzá — a
--    korábbi, mindenki-lát-mindent policy (lásd 0003_fix_babies_select_
--    policy.sql) egy tyúk-tojás problémát oldott meg (nickname-keresés +
--    INSERT...RETURNING láthatóság), de ezzel minden bejelentkezett user
--    (és korábban a globális owner is) hozzáférhetett idegen babák
--    születési dátumához/helyéhez/súlyához/hosszához is.
--
--    Az eredeti tyúk-tojás problémát most három SECURITY DEFINER RPC
--    váltja ki, amik a szükséges minimumot adják vissza (nem a teljes
--    sort), az RLS-t explicit megkerülve, csak ott ahol ez indokolt:
--    - search_baby_nickname: csak id+nickname (regisztrációs kereséshez)
--    - create_baby: atomikusan létrehozza a babát ÉS az admin-tagságot
--    - owner_babies_overview: csak id+nickname+full_name, csak globális
--      ownernek (a felügyeleti "admin nélküli baba" listázáshoz) — SOHA
--      nem ad vissza születési adatot, még az ownernek sem.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nickname egyediség (case-insensitive)
-- ------------------------------------------------------------
create unique index babies_nickname_unique_ci on babies (lower(nickname));

-- ------------------------------------------------------------
-- 2) Numerikus range-check-ek — laza határok, csak a nyilvánvalóan hibás
-- (negatív, elgépelt) értékek kiszűrésére, nem orvosi pontosságú validáció
-- ------------------------------------------------------------
alter table weight_measurements
  add constraint weight_measurements_weight_g_range check (weight_g > 0 and weight_g < 30000);

alter table feedings
  add constraint feedings_weight_before_range check (weight_before_g is null or (weight_before_g > 0 and weight_before_g < 30000)),
  add constraint feedings_weight_after_range check (weight_after_g is null or (weight_after_g > 0 and weight_after_g < 30000)),
  add constraint feedings_extra_milk_range check (extra_milk_ml is null or (extra_milk_ml >= 0 and extra_milk_ml < 1000)),
  add constraint feedings_extra_formula_range check (extra_formula_ml is null or (extra_formula_ml >= 0 and extra_formula_ml < 1000));

alter table babies
  add constraint babies_birth_weight_range check (birth_weight_g is null or (birth_weight_g > 0 and birth_weight_g < 10000)),
  add constraint babies_birth_length_range check (birth_length_cm is null or (birth_length_cm > 0 and birth_length_cm < 100));

-- ------------------------------------------------------------
-- 3) RPC-k a babies-hozzáféréshez
-- ------------------------------------------------------------

-- Regisztrációs nickname-keresés — csak id+nickname, RLS-t megkerülve
-- (mielőtt a usernek bármilyen baby_members sora lenne).
create or replace function search_baby_nickname(p_nickname text)
returns table(id uuid, nickname text)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.nickname from babies b where lower(b.nickname) = lower(trim(p_nickname)) limit 1;
$$;

-- Atomikus baba+admin-tagság létrehozás — az első regisztráló azonnal
-- admin+approved lesz, egyetlen tranzakcióban (nincs INSERT...RETURNING
-- láthatósági probléma, mert SECURITY DEFINER-ként fut).
create or replace function create_baby(p_nickname text, p_full_name text)
returns table(id uuid, nickname text, full_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baby_id uuid;
begin
  insert into babies (nickname, full_name)
  values (trim(p_nickname), nullif(trim(p_full_name), ''))
  returning babies.id into v_baby_id;

  insert into baby_members (baby_id, user_id, role, status, approved_at)
  values (v_baby_id, auth.uid(), 'admin', 'approved', now());

  return query select b.id, b.nickname, b.full_name from babies b where b.id = v_baby_id;
end;
$$;

-- Owner globális áttekintője — csak a felügyelethez szükséges mezők
-- (id, nickname, full_name). Szándékosan NEM ad vissza születési
-- dátumot/súlyt/hosszt/helyet, még az ownernek sem, ha nem jóváhagyott
-- tagja az adott babának.
create or replace function owner_babies_overview()
returns table(id uuid, nickname text, full_name text)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.nickname, b.full_name from babies b where is_global_owner();
$$;

-- ------------------------------------------------------------
-- 4) babies SELECT policy szigorítása — kizárólag jóváhagyott tagok
-- ------------------------------------------------------------
drop policy if exists "babies_select_authenticated" on babies;
create policy "babies_select_members" on babies
  for select using (is_approved_member(id));

-- Az INSERT policy-t is megszüntetjük: mostantól kizárólag a fenti
-- create_baby() RPC-n (SECURITY DEFINER, megkerüli az RLS-t) keresztül
-- jöhet létre új baba — közvetlen kliens-oldali INSERT-nek nincs többé
-- sanctionált útja, ez zárja be azt a rést, hogy valaki a create_baby
-- megkerülésével, admin-tagság nélkül hozzon létre "árva" babát.
drop policy if exists "babies_insert_authenticated" on babies;
