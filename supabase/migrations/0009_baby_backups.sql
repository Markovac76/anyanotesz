-- ============================================================
-- 7. lépés: napi biztonsági mentés (Excel, Storage) + emailben kérés
--
-- FONTOS: ezt a migrációt NE futtasd le automatikusan — a fájl végén lévő
-- cron.schedule() rész szándékosan komment marad, amíg a daily-backup
-- Edge Function ténylegesen deployolva nincs (lásd a lépés végi checklist).
-- ============================================================

-- ------------------------------------------------------------
-- 1) is_approved_admin — az is_approved_member() mintájára (0002_rls.sql),
-- de szigorúbb: csak admin szerepkörre. Ez védi a Storage bucket-et —
-- a nyers, minden mezőt tartalmazó mentésekhez nem elég jóváhagyott
-- tagnak lenni, admin kell legyen.
-- ------------------------------------------------------------
create or replace function is_approved_admin(p_baby_id uuid)
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
      and role = 'admin'
      and status = 'approved'
  );
$$;

-- ------------------------------------------------------------
-- 2) Storage bucket — privát (nincs public URL-elérés)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('baby-backups', 'baby-backups', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3) Storage policy — kizárólag a baba adminjai olvashatnak, senki nem
-- írhat/törölhet kliens-oldalról. A fájlok elérési útja
-- {baby_id}/{ÉÉÉÉ-HH-NN}.xlsx, ezért az útvonal első szegmenséből
-- (storage.foldername) nyerjük ki a baby_id-t.
--
-- Szándékosan nincs INSERT/UPDATE/DELETE policy: a mentések kizárólag a
-- daily-backup Edge Function-ön keresztül, service role kulccsal
-- íródnak/törlődnek, ami eleve megkerüli a Storage RLS-t. Ez a legszűkebb
-- lehetséges kliens-oldali jogosultság.
-- ------------------------------------------------------------
create policy "baby_backups_admin_select" on storage.objects
  for select
  using (
    bucket_id = 'baby-backups'
    and is_approved_admin((storage.foldername(name))[1]::uuid)
  );

-- ------------------------------------------------------------
-- 4) pg_net / pg_cron engedélyezése (ha még nincs)
-- ------------------------------------------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- 5) A napi ütemezés — CSAK az Edge Function deploy UTÁN futtatandó
-- (lásd a lépés végi checklist 4. pontja), a tényleges function URL-lel.
--
-- A Supabase jelenleg hivatalosan ajánlott mintája (2026-os dokumentáció
-- szerint, ellenőrizve) a Vault-ban tárolt titkot használja a
-- cron.schedule() SQL-jében, NEM egy nyílt szövegű, a migrációs fájlba
-- (git-be!) beégetett kulcsot — a te eredeti vázlatod ez utóbbit
-- tartalmazta placeholderként, ezt szándékosan cseréltem le, mert a
-- migrációs fájlok git-history-ba kerülnek, egy oda beírt valódi titkos
-- kulcs örökre ott maradna, még törlés után is visszakereshetően.
--
-- ELŐSZÖR (egyszer, a Supabase SQL Editorban vagy CLI-vel, KÉZZEL, miután
-- legeneráltad a BACKUP_CRON_SECRET-et — lásd checklist 3. pont):
--
--   select vault.create_secret('<a te BACKUP_CRON_SECRET értéked>', 'backup_cron_secret');
--
-- UTÁNA, a tényleges deployolt function URL-lel kiegészítve:
--
-- select cron.schedule(
--   'anyanotesz-daily-backup',
--   '0 21 * * *',  -- napi egyszer, kb. magyar idő szerint este (UTC+2 nyáron -> 23:00, télen UTC+1 -> 22:00)
--   $$
--   select net.http_post(
--     url := 'https://hatmnkenpmmutaqfrnvs.supabase.co/functions/v1/daily-backup',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
