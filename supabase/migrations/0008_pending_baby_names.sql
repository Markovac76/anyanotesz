-- Egy pending (még jóvá nem hagyott) baba-tagsághoz tartozó nicknevet ad
-- vissza — kizárólag a HÍVÓ SAJÁT baby_members sorai alapján (bármilyen
-- státusszal), így a babies_select_members (0007_lock_babies_select.sql)
-- szigorítását nem kerüli meg mások adataira nézve, csak a saját (akár
-- még nem approved) tagságok baba-nevét oldja fel a kliens oldali
-- baba-választó számára ("Másik baba hozzáadása" funkció, 5. lépés).
create or replace function my_membership_baby_names()
returns table(baby_id uuid, nickname text)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.nickname
  from babies b
  join baby_members bm on bm.baby_id = b.id
  where bm.user_id = auth.uid();
$$;
