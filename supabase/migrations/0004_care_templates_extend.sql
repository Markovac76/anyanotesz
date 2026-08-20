-- Karbantartás oldal: a care_templates tábla bővítése a "weekly" (heti)
-- gyakorisággal és a gyógyszer/tevékenység sablonokat megkülönböztető
-- "category" mezővel — lásd specifikacio.md 3. és 6.6. pont.
--
-- weekly viselkedése ugyanaz a minta, mint a monthly-nál (a legutóbbi
-- care_logs bejegyzéstől számított fordulónap dönti el, esedékes-e), csak
-- 7 nap múlva jár le 1 hónap helyett — a logika kliens oldalon számolódik,
-- nincs hozzá külön oszlop.

alter table care_templates
  drop constraint if exists care_templates_frequency_check;

alter table care_templates
  add constraint care_templates_frequency_check
  check (frequency in ('daily', 'weekly', 'monthly'));

alter table care_templates
  add column category text
  check (category in ('medication', 'activity'));

-- meglévő fix sablonok (lásd 0001_init.sql) kategorizálása
update care_templates set category = 'medication' where name in ('D-vitamin csepp', 'K-vitamin csepp');
update care_templates set category = 'activity' where name = 'Köldökápolás';
