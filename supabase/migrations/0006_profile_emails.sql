-- ============================================================
-- Email megjelenítése a "Userek" felületen nyers user_id helyett.
--
-- Az auth.users tábla (és az email mező) nincs kitéve a kliens felé, ezért
-- egy denormalizált másolatot tartunk a profiles táblában, szinkronban
-- tartva insert/update triggerekkel. A profiles SELECT policy bővül: eddig
-- csak a saját sorát láthatta mindenki, mostantól egy approved admin/user
-- a saját (jóváhagyott) babáinak többi jóváhagyott tagját is látja, a
-- globális owner pedig mindenkit — ugyanaz a láthatósági elv, mint a
-- baby_members táblánál.
-- ============================================================

alter table profiles add column email text;

update profiles p set email = u.email
from auth.users u
where u.id = p.id;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, is_owner, email) values (new.id, false, new.email);
  return new;
end;
$$;

-- Ha valaki megváltoztatja az email címét, a profiles-beli másolat is
-- frissüljön — enélkül elavult email jelenne meg a Userek felületen.
create or replace function handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function handle_user_email_update();

-- Két user "megosztja-e" ugyanazt a babát — ez adja a profiles
-- SELECT-bővítés alapját. Szándékosan nem szűrünk a másik fél
-- státuszára (bm2.status): egy admin a saját babájához érkező FÜGGŐBEN
-- LÉVŐ kérelmező emailjét is lássa, hiszen épp az alapján dönt a
-- jóváhagyásról/elutasításról, nem csak a már jóváhagyott tagokét.
create or replace function shares_approved_baby(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from baby_members bm1
    join baby_members bm2 on bm1.baby_id = bm2.baby_id
    where bm1.user_id = auth.uid() and bm1.status = 'approved'
      and bm2.user_id = p_user_id
  );
$$;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_visible" on profiles
  for select using (
    id = auth.uid()
    or is_global_owner()
    or shares_approved_baby(id)
  );
