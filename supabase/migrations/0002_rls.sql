-- ============================================================
-- Row Level Security — Anyanotesz
--
-- Elv: egy user csak azokhoz a sorokhoz fér hozzá, amelyek baby_id-ja
-- szerepel a baby_members táblában az ő user_id-jával és status='approved'
-- értékkel. Kivétel a baby_members tábla saját magára (lásd lent).
--
-- A segédfüggvények SECURITY DEFINER-ként futnak, hogy a baby_members
-- táblára vonatkozó policy-k ne rekurzáljanak önmagukba (a baby_members
-- SELECT policy-jának ki kellene értékelnie egy baby_members lekérdezést).
-- ============================================================

create or replace function is_approved_member(p_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from baby_members
    where baby_id = p_baby_id
      and user_id = auth.uid()
      and status = 'approved'
  );
$$;

create or replace function is_owner_or_admin(p_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from baby_members
    where baby_id = p_baby_id
      and user_id = auth.uid()
      and status = 'approved'
      and role in ('owner', 'admin')
  );
$$;

-- ------------------------------------------------------------
-- babies
-- ------------------------------------------------------------
alter table babies enable row level security;

-- Bármely bejelentkezett user lássa a babies tábla sorait (nickname,
-- full_name stb.) — ez a regisztrációs folyamat becenév-keresésének
-- előfeltétele: mielőtt a userhez bármilyen baby_members sora létezne,
-- meg kell tudnia állapítani, hogy van-e már ilyen becenevű baba.
-- (A tényleges napi adatokat — feedings, diapers stb. — továbbra is csak
-- a jóváhagyott tagok látják, lásd lent.)
--
-- Megjegyzés: ez a policy egyben azt a Postgres-viselkedést is kezeli, hogy
-- INSERT ... RETURNING (amit a Supabase JS kliens .insert().select() hívása
-- generál) a beszúrt sor SELECT-láthatóságát is megköveteli — enélkül az
-- "első baba létrehozása" lépés RLS-hibával futott volna el, még a
-- WITH CHECK (true) insert policy mellett is.
create policy "babies_select_authenticated" on babies
  for select
  to authenticated
  using (true);

-- Bárki (bejelentkezett user) létrehozhat új babát — ez a regisztrációs
-- folyamat része, mielőtt még bármilyen baby_members sora lenne.
create policy "babies_insert_authenticated" on babies
  for insert to authenticated
  with check (true);

create policy "babies_update_owner_admin" on babies
  for update using (is_owner_or_admin(id))
  with check (is_owner_or_admin(id));

create policy "babies_delete_owner" on babies
  for delete using (is_owner_or_admin(id));

-- ------------------------------------------------------------
-- baby_members
-- ------------------------------------------------------------
alter table baby_members enable row level security;

-- Saját sorait mindenki látja (bármilyen status), owner/admin pedig
-- a hozzá tartozó baba összes tagsági sorát.
create policy "baby_members_select" on baby_members
  for select using (
    user_id = auth.uid() or is_owner_or_admin(baby_id)
  );

-- Saját sor felvétele: sima csatlakozási kérelem mindig 'pending'-del
-- mehet. 'approved' + 'owner' kizárólag akkor, ha ő az ELSŐ tagja a
-- babának (vadonatúj baba, senki más nem hagyhatná jóvá).
create policy "baby_members_insert_self" on baby_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      status = 'pending'
      or (
        status = 'approved'
        and role = 'owner'
        and not exists (
          select 1 from baby_members m2 where m2.baby_id = baby_members.baby_id
        )
      )
    )
  );

-- Jóváhagyás/elutasítás/szerepkör-módosítás: csak owner/admin, a saját
-- babájához tartozó sorokon.
create policy "baby_members_update_owner_admin" on baby_members
  for update using (is_owner_or_admin(baby_id))
  with check (is_owner_or_admin(baby_id));

-- Törlés: saját (pl. függőben lévő kérelem visszavonása) vagy owner/admin
-- a saját babájához tartozó bármely taghoz.
create policy "baby_members_delete" on baby_members
  for delete using (
    user_id = auth.uid() or is_owner_or_admin(baby_id)
  );

-- ------------------------------------------------------------
-- Adat-táblák: weight_measurements, feedings, diapers,
-- care_templates, care_logs, questions
-- ------------------------------------------------------------

alter table weight_measurements enable row level security;
create policy "weight_measurements_all" on weight_measurements
  for all using (is_approved_member(baby_id))
  with check (is_approved_member(baby_id));

alter table feedings enable row level security;
create policy "feedings_all" on feedings
  for all using (is_approved_member(baby_id))
  with check (is_approved_member(baby_id));

alter table diapers enable row level security;
create policy "diapers_all" on diapers
  for all using (is_approved_member(baby_id))
  with check (is_approved_member(baby_id));

alter table care_templates enable row level security;
create policy "care_templates_all" on care_templates
  for all using (is_approved_member(baby_id))
  with check (is_approved_member(baby_id));

alter table care_logs enable row level security;
create policy "care_logs_all" on care_logs
  for all using (is_approved_member(baby_id))
  with check (is_approved_member(baby_id));

alter table questions enable row level security;
create policy "questions_all" on questions
  for all using (is_approved_member(baby_id))
  with check (is_approved_member(baby_id));
