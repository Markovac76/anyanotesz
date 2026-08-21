-- ============================================================
-- Jogosultsági modell átalakítása: globális owner + baba-szintű admin/user
--
-- Régi modell: baby_members.role in ('user','admin','owner') — az 'owner'
-- baba-szintű volt (az adott baba első, jóváhagyó nélküli tagja).
--
-- Új modell:
-- - Globális 'owner' egy külön `profiles.is_owner` mezőben, kizárólag
--   manuális SQL-lel állítható (nincs hozzá RLS UPDATE policy).
-- - Baba-szinten csak 'admin' és 'user' marad — az addigi baba-szintű
--   'owner' sorok 'admin'-ra konvertálódnak (ő volt az első/egyetlen tag).
-- - A globális owner globális SELECT-et kap a babies/baby_members táblákra
--   (áttekintő felület), plusz vészhelyzeti jogot admin nélkül maradt
--   babáknál (admin-kijelölés vagy a baba törlése) — a napi adat-táblákhoz
--   (feedings, diapers, weight_measurements, care_*, questions) továbbra
--   sincs kivétele, azokhoz is csak jóváhagyott tagként férhet hozzá.
-- ============================================================

-- ------------------------------------------------------------
-- 1) profiles tábla — globális owner-flag
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_owner boolean not null default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Mindenki csak a SAJÁT sorát látja — ennyi kell a kliensnek az
-- "owner vagyok-e" ellenőrzéshez, más profiljára nincs szükség.
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

-- SZÁNDÉKOSAN nincs insert/update/delete policy authenticated userekre —
-- az is_owner mezőt (és a sor létrehozását) csak a lenti trigger
-- (SECURITY DEFINER, táblatulajdonosként fut, megkerüli az RLS-t) vagy
-- manuális SQL / service_role módosíthatja.

-- ------------------------------------------------------------
-- 2) Automatikus profil-létrehozás új regisztrációnál
-- ------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, is_owner) values (new.id, false);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- 3) Meglévő userek visszatöltése + a kezdő globális owner beállítása
-- ------------------------------------------------------------
insert into profiles (id, is_owner)
select id, false from auth.users
on conflict (id) do nothing;

update profiles set is_owner = true
where id = (select id from auth.users where email = 'g.marcell.kovacs@gmail.com');

-- ------------------------------------------------------------
-- 4) baby_members.role — az 'owner' kivezetése baba-szinten
-- ------------------------------------------------------------
update baby_members set role = 'admin' where role = 'owner';

alter table baby_members drop constraint baby_members_role_check;
alter table baby_members add constraint baby_members_role_check check (role in ('admin', 'user'));

-- ------------------------------------------------------------
-- 5) Segédfüggvények
-- ------------------------------------------------------------

-- A régi is_owner_or_admin(baby_id) helyett — mivel baba-szinten már nincs
-- 'owner', ez most kizárólag az 'admin' szerepkört nézi.
create or replace function is_baby_admin(p_baby_id uuid)
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
      and role = 'admin'
  );
$$;

create or replace function is_global_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_owner from profiles where id = auth.uid()), false);
$$;

create or replace function baby_has_admin(p_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from baby_members
    where baby_id = p_baby_id
      and status = 'approved'
      and role = 'admin'
  );
$$;

-- (A régi is_owner_or_admin függvényt csak azután távolítjuk el, hogy az
-- alábbi lépésekben minden rá hivatkozó policy le lett cserélve — lásd a
-- fájl végén.)

-- ------------------------------------------------------------
-- 6) babies policy-k cseréje
-- ------------------------------------------------------------

-- babies_select_authenticated változatlan marad (mindenki lát minden babát
-- — ez adja az owner globális rálátásának egyik felét ingyen, és a
-- regisztrációs nickname-keresés előfeltétele is).

drop policy if exists "babies_update_owner_admin" on babies;
create policy "babies_update_owner_admin" on babies
  for update using (is_baby_admin(id))
  with check (is_baby_admin(id));

drop policy if exists "babies_delete_owner" on babies;
create policy "babies_delete_owner" on babies
  for delete using (
    is_baby_admin(id)
    or (is_global_owner() and not baby_has_admin(id))
  );

-- ------------------------------------------------------------
-- 7) baby_members policy-k cseréje
-- ------------------------------------------------------------

drop policy if exists "baby_members_select" on baby_members;
create policy "baby_members_select" on baby_members
  for select using (
    user_id = auth.uid()
    or is_baby_admin(baby_id)
    or is_global_owner()
  );

drop policy if exists "baby_members_insert_self" on baby_members;
create policy "baby_members_insert_self" on baby_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (status = 'pending' and role = 'user')
      or (
        status = 'approved'
        and role = 'admin'
        and not exists (
          select 1 from baby_members m2 where m2.baby_id = baby_members.baby_id
        )
      )
    )
  );

drop policy if exists "baby_members_update_owner_admin" on baby_members;
create policy "baby_members_update_owner_admin" on baby_members
  for update using (
    is_baby_admin(baby_id)
    or (is_global_owner() and not baby_has_admin(baby_id))
  )
  with check (
    is_baby_admin(baby_id)
    or (is_global_owner() and not baby_has_admin(baby_id))
  );

drop policy if exists "baby_members_delete" on baby_members;
create policy "baby_members_delete" on baby_members
  for delete using (
    user_id = auth.uid() or is_baby_admin(baby_id)
  );

-- ------------------------------------------------------------
-- 8) Adat-táblák — VÁLTOZATLANOK (is_approved_member(baby_id) marad az
-- egyetlen feltétel, owner nem kap kivételt): weight_measurements,
-- feedings, diapers, care_templates, care_logs, questions.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 9) Régi függvény eltávolítása — csak most, hogy minden policy, ami rá
-- hivatkozott, már le lett cserélve.
-- ------------------------------------------------------------
drop function if exists is_owner_or_admin(uuid);
