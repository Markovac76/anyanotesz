-- Javítás: a 0002_rls.sql eredeti "babies_select_members" policy-ja csak a
-- babának már jóváhagyott tagjainak engedte a SELECT-et. Ez két hibát okozott:
--
-- 1) A regisztráció "van-e már ilyen becenevű baba?" keresése (findBabyByNickname)
--    mindig üres találatot adott vissza, hiszen a keresést végző usernek még
--    nincs baby_members sora semelyik babához — így soha nem talált meg
--    létező babát, és mindig az "új baba létrehozása" ágra futott.
--
-- 2) Új baba létrehozásakor a Supabase JS kliens .insert().select() hívása
--    egy INSERT ... RETURNING-et generál, aminek a Postgres RLS a beszúrt sor
--    SELECT-láthatóságát is megköveteli. Mivel a létrehozó usernek ekkor még
--    nem volt baby_members sora az új babához, ez a láthatósági ellenőrzés
--    elbukott — innen a "new row violates row-level security policy for
--    table babies" hiba, annak ellenére, hogy az INSERT-policy (WITH CHECK)
--    önmagában rendben volt.
--
-- Megoldás: a babies tábla SELECT-je legyen nyitott minden bejelentkezett
-- userre (a nickname/full_name/születési adatok nem érzékenyek olyan
-- értelemben, mint a napi naplóbejegyzések — azokat továbbra is csak a
-- jóváhagyott tagok látják a többi tábla policy-jain keresztül).

drop policy if exists "babies_select_members" on babies;

create policy "babies_select_authenticated" on babies
  for select
  to authenticated
  using (true);
