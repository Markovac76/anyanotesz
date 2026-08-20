# Anyanotesz — Specifikáció v1.0

Szoptatás- és baba-napló alkalmazás, a Lapról Lapra projekt architektúráját és munkamódszerét követve.

## Alapelvek

- **Keep It Simple** — minden funkciónál az egyszerűbb megoldás preferált, bővítés csak ha ténylegesen szükségessé válik
- **Mobil-first** — elsődleges céleszközök: Samsung Galaxy S24 Ultra / S25 Ultra, egykezes, hüvelykujjas használatra optimalizálva (szoptatás közbeni adatbevitel a fő használati eset)
- Asztali gépen/laptopon is használható, de nem az az elsődleges nézet
- A demó (`anyanotesz-demo.jsx`) a végleges vizuális referencia — a design tokenek, elrendezés, interakciós minták onnan veendők át

---

## 1. Technológiai stack

Azonos a Lapról Lapra mintájával:

| Réteg | Technológia |
|---|---|
| Frontend | Natív ES modulok, build-eszköz nélkül (`js/` mappa, `index.html`, `styles.css`) |
| Backend / adatbázis | Supabase (Postgres + Auth + Row Level Security) |
| Hosting | Vercel |
| PWA | `manifest.json` + ikonok, telepíthető kezdőképernyőre |
| Grafikonok | Recharts (vagy natív Canvas — a demóban Recharts-szal készült) |

Env változók (`config.js`, nincs git-ben): `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

---

## 2. Szerepkörök és jogosultság

Háromszintű modell a Lapról Lapra mintájára: **owner / admin / user**.

- Regisztráláskor mindenki alapból **user**.
- Az **owner** látja a felhasználókat, és adminná léptetheti (vagy visszaléptetheti) őket.
- **Owner és admin**: több babához is hozzáférhetnek, és tudnak köztük váltani.
- **User**: pontosan egy jóváhagyott babához van kötve, nincs váltógomb, fixen a saját gyereke jelenik meg.
- **Induló beállítás (MVP fókusz)**: 1 baba + 2 user (anya + apa). Az ikrek/több gyerek irány csak nyitva hagyott lehetőség az owner/admin szintű váltogatás miatt, de az első fejlesztési kör erre nem épít bonyolult UX-et.

### Regisztrációs folyamat

1. Regisztrációkor meg kell adni egy **becenevet** a babának (nem a teljes nevet — elgépelés-kockázat csökkentése).
2. Ha van már ilyen becenevű baba a rendszerben → a user csatlakozást kérhet hozzá. Az **owner hagyja jóvá**.
3. Ha nincs ilyen becenevű baba → a user új babát vihet fel (becenév + teljes név). Ezt is az **owner hagyja jóvá**.
4. Amíg a kérelem függőben van, a user egy egyszerű **"Várakozás jóváhagyásra"** képernyőt lát, nem fér hozzá adatokhoz.
5. Az ownernek a **Felhasználók** felületen egy **függőben lévő kérelmek** szekció mutatja az új kéréseket, jóváhagyó/elutasító gombbal.
6. **Nincs email-értesítés** ehhez (Keep It Simple) — az owner belépéskor látja, ha van függő kérés.

---

## 3. Adatmodell (Supabase táblák)

```sql
-- Babák
create table babies (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  full_name text,
  born_at timestamptz,
  birth_place text,
  birth_weight_g int,
  birth_length_cm numeric,
  weekly_gain_target_g int default 150,
  created_at timestamptz default now()
);

-- Felhasználó–baba kapcsolat, jogosultsággal és jóváhagyási állapottal
create table baby_members (
  baby_id uuid references babies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'user' check (role in ('user','admin','owner')),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  primary key (baby_id, user_id)
);

-- Ruhátlan testsúlymérés — ez adja a súlygörbe és a heti gyarapodás alapját
create table weight_measurements (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  measured_at timestamptz not null,
  weight_g int not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Szoptatás
create table feedings (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  side text check (side in ('left','right','both')),
  started_at timestamptz not null,
  ended_at timestamptz,
  cant_measure boolean default false,
  weight_before_g int,
  weight_after_g int,
  extra_milk_ml int,
  extra_formula_ml int,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Pelenkacsere
create table diapers (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  type text check (type in ('pisi','kaki','mindketto')),
  poop_color text,
  poop_texture text,
  note text,
  changed_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Ismétlődő teendő sablonok (Karbantartásban szerkeszthető: gyógyszer és tevékenység sablonok, szabadon bővíthetők)
create table care_templates (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  category text check (category in ('medication','activity')),
  name text not null,
  frequency text check (frequency in ('daily','weekly','monthly')),
  created_at timestamptz default now()
);

-- Ismétlődő teendő naplózása (mikor történt meg)
create table care_logs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references care_templates(id) on delete cascade,
  baby_id uuid references babies(id) on delete cascade,
  done_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Kérdések a védőnőnek/orvosnak
create table questions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  text text not null,
  recipient text check (recipient in ('vedono','orvos')),
  answer text,
  answered boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

Minden táblán **Row Level Security** aktív; a policy-k a `baby_members` táblán keresztül ellenőrzik, hogy a bejelentkezett user jóváhagyott tagja-e az adott babának (a Lapról Lapra `member_series`-hez hasonló mintára).

> Megjegyzés: a `care_templates`/`care_logs` páros teszi lehetővé, hogy tetszőleges gyógyszer/vitamin (`category = 'medication'`) és tevékenység (`category = 'activity'`) sablon kezelhető legyen ugyanazzal a szerkezettel, napi/heti/havi gyakorisággal. A `category` mező csak a megjelenítést különíti el (két külön lista a Karbantartásban és a főoldalon), technikailag egy táblában laknak. Az emlékeztető-logika (esedékes-e, hány nap van hátra) kliens oldalon számolódik a `care_logs` legutóbbi bejegyzéséből, a heti/havi esetben "hátralévő napok" visszaszámlálóval.

---

## 4. Fejléc és navigáció

- App név: **Anyanotesz**
- Gombok: **Karbantartás**, **Súgó**, **Kilépés** (mindenkinek), **Felhasználók** (csak owner)
- **Karbantartás**: baba alapadatok szerkesztése, gyógyszer-sablonok és tevékenység-sablonok kezelése (részletek a 6.6 pontban)
- A "gyerek neve" sáv a fejléc alatt:
  - **User**: fixen a saját gyereke neve, nincs váltás
  - **Owner/admin**: gyerek-választó, amivel a hozzá tartozó babák között lehet váltani

---

## 5. Gyerek-doboz (mindig látható infósáv)

- Születési adatok: dátum + óra:perc, hely, születési súly, születési hossz
- **Aktuális súly** — nagy, kiemelt szám (a legutóbbi `weight_measurements` bejegyzésből)
- **Heti gyarapodás** — hétfőtől hétfőig számolva, a `weekly_gain_target_g` alapján, színjelzéssel:
  - 🟢 **zöld**: tényleges gyarapodás az elvárt eddigi ütem 85–115%-a között
  - 🟡 **sárga**: 50–85% vagy 115–150% között (eltér, de behozható / túl gyors)
  - 🔴 **piros**: 50% alatt vagy súlyvesztés

---

## 6. Funkció-dobozok (mind összecsukható)

### 6.1 Ruhátlan testsúlymérés
Ez adja az aktuális súly és a heti gyarapodás számításának alapját. Mezők: Dátum, Idő, Súly (g) — kötelező mező, nincs "nem mérhető" opció.

### 6.2 Szoptatás
- Dátum (teljes szélességben), alatta két mező egymás mellett: **Idő (kezdet)**, **Idő (befejezés)**
- Bal/Jobb/Mindkettő választó
- **"Nem mérhető most"** kapcsoló — ha be van kapcsolva, a súlymezők kimaradnak a bejegyzésből és a számításokból
- Súly a szoptatás elején / végén (g) — ha mindkettő megadva, automatikusan számolt **becsült elfogyasztott mennyiség** jelenik meg
- Kiegészítők: + Anyatej (ml), + Tápszer (ml)

### 6.3 Pelenkacsere
- Dátum, Idő
- Típus: Pisi / Kaki / Mindkettő
- Ha van kaki: **Szín** (sárga / zöld / barna / fekete / vörös-véres / fehér-szürke) és **Állag** (pépes / szilárd / híg-vizes / nyákos) — két külön választó
- Opcionális jegyzet

### 6.4 Egyéb
- **Köldökápolás**: napi "megtörtént" jelölő, in-app figyelmeztetés, ha estig nem történt meg. Technikailag egy `activity` kategóriájú, napi gyakoriságú `care_template` — a Karbantartásban szerkeszthető/törölhető, mint bármelyik tevékenység-sablon.
- **Gyógyszer/vitamin sablonok**: a Karbantartásban szabadon felvehető, szerkeszthető, törölhető sablonok (`category = 'medication'`), napi/heti/havi gyakorisággal. Az MVP induláskor két alapértelmezett sablon jön létre: D-vitamin csepp (napi) és K-vitamin csepp (havi) — ezek is szabadon módosíthatók/törölhetők.
- **Tevékenység sablonok**: ugyanígy szabadon bővíthető lista (`category = 'activity'`), a köldökápolás az induló alapértelmezett elem.
- Napi gyakoriságú elemeknél: napi pipálás, figyelmeztetés, ha estig nem történt meg.
- Heti/havi gyakoriságú elemeknél: ha esedékes → figyelmeztetés + "Beadva/Megtörtént" gomb. Ha nemrég megtörtént → **visszaszámláló** a következő esedékességig ("még X nap"), a gomb eltűnik (nem visszavonható az állapot).
- Mindhárom kategória (gyógyszer, tevékenység, és maguk a napi/heti/havi bejegyzések) **historikus bejegyzést is generál** ("Egyéb" típusként), ami a Historikus adatok listában megjelenik és ugyanúgy szerkeszthető/törölhető, mint bármi más.

### 6.5 Kérdések a védőnőnek / orvosnak
- A doboz címe alatt két szűrő-sor:
  - **Címzett szerint**: Mind / Védőnő / Orvos
  - **Állapot szerint**: Mind / Még nem válaszolt / Megválaszolt
- Minden kérdés önmagában is kinyitható sor: zárt állapotban színes állapot-pötty (sárga = aktuális, zöld = megválaszolt), címzett-címke, kérdés szövege
- Kinyitva: címzett módosítható, **válasz** mező (több soros szöveg), **állapot** váltó (Még aktuális / Megválaszolva)
- Új kérdés felvitelekor is választható előre a címzett

### 6.6 Karbantartás

A fejlécben lévő Karbantartás gomb egy külön oldalra navigál, három szekcióval:

1. **Baba alapadatai** — szerkeszthető űrlap: becenév, teljes név, születési dátum/idő, hely, súly, hossz, heti gyarapodási cél (g)
2. **Gyógyszer sablonok** — lista (`care_templates`, `category = 'medication'`), soronként szerkeszthető/törölhető, plusz "Új sablon" gomb (név + gyakoriság: naponta/hetente/havonta)
3. **Tevékenység sablonok** — ugyanígy, `category = 'activity'`

Mind a gyógyszer, mind a tevékenység listák megjelenítése és szerkesztése egységes UI-t követ (Keep It Simple), csak külön szekcióban jelennek meg, hogy logikailag elkülönüljenek.

---

## 7. Dátum/idő és szám-bevitel (egykezes UX minden mezőnél)

- **Dátum mező**: nagy, félkövér felirat + gomb, mellette **"Ma"** gyorsgomb. Koppintásra naptár nyílik (hónapváltó nyilakkal). Ha korábbi napot választasz, mentés előtt megerősítést kér ("Ez egy korábbi időpont... biztos?").
- **Idő mező**: ugyanígy, **"Most"** gyorsgombbal. Koppintásra egy görgethető (fel-le pörgethető) óra:perc választó nyílik, nem natív billentyűzet.
- **Szám-mezők** (súly, ml): a mező nagy, félkövér, középre igazított számot mutat. Koppintásra egy saját, felugró **számbillentyűzet** nyílik (0–9, törlés, backspace) — nincs natív telefon-billentyűzet, ami eltakarná a képernyőt szoptatás közben.
- Alapból minden dátum/idő mező a **jelenlegi** időpontra áll be, ez módosítható.

---

## 8. Historikus adatok oldal

- Külön oldal, saját, nagyméretű **Vissza** gombbal (egykezes elérésre optimalizálva)
- Minden bejegyzés egy közös, kronologikus listában, a legújabb elöl
- Minden sor elején a **pontos dátum és idő**, utána a relatív jelző ("· ma", "· tegnap")
- **Szűrés típus szerint**: Szoptatás / Pelenkacsere / Egyéb / Ruhátlan testsúlymérés (chipek, egyszerre több is bekapcsolható)
- **Módosítás**: minden sor jobb szélén toll-ikon + "Módosítás" felirat — ugyanaz a felugró ablak nyílik, mint amivel a bejegyzés eredetileg készült, előre kitöltve
- Az ablak alján **Mégse** + **Mentés**, alattuk egy kisebb **"Bejegyzés törlése"** gomb — törlés csak egy második megerősítő koppintás után történik meg
- **Grafikonok** gomb → külön oldalra navigál (lásd 9. pont)
- **Excel export** gomb → az MVP-ben "Fejlesztés alatt" üzenetet mutat

---

## 9. Grafikonok oldal

Külön oldal, saját Vissza gombbal (a Historikus adatok oldalra visz vissza). Három diagram egymás alatt:

1. **Súlygörbe** — Heti / Havi bontás, cél-vonallal együtt ábrázolva
2. **Szoptatások** — Napi / Heti / Havi bontás (napi nézetben óránkénti, heti/havi nézetben napi összesítés)
3. **Pelenkacserék** — Napi / Heti / Havi bontás, Pisi/Kaki külön színnel

Mindhárom diagramnál azonos navigációs minta: bal/jobb nyíl a léptetéshez, középen az aktuális időszak felirata (pl. "2026.08.18. · ma", "2026. aug. 11–17.", "2026. augusztus"), a jobbra-nyíl letiltva, ha már a jelenlegi időszaknál vagyunk (nem lehet a jövőbe navigálni).

---

## 10. Export

- **MVP-ben placeholder**: az Excel export gomb "Fejlesztés alatt" üzenetet mutat, funkció nélkül (sem letöltés, sem email-küldés)
- **Későbbi fejlesztés**: Excel letöltés (a Historikus oldal aktuális szűrése szerint, típusonként külön munkalappal), majd azt követően email-küldés

---

## 11. Az MVP-ben szándékosan placeholder / későbbi fejlesztés

| Funkció | Állapot |
|---|---|
| Excel export | "Fejlesztés alatt" üzenet — sem letöltés, sem email-küldés nincs az MVP-ben |
| Push notification | Nincs — az emlékeztetők egyelőre csak in-app jelzések |
| Ikrek / 3+ gyerek UX finomítása | Az owner/admin váltogatás technikailag megvan, de nincs rá külön kidolgozott folyamat |
| Jelszó/kód mező "megmutatás" funkciója | A regisztrációs és bejelentkezési mezőknél (pl. jelszó) legyen egy szem-ikon vagy hasonló, amivel meg lehet nézni, mit gépeltünk be — jelenleg vakon kell gépelni, elgépelés esetén nincs mód ellenőrizni/javítani |

---

## 12. Vizuális stílus

A Lapról Lapra design tokenjeit követi (sötét téma, kék akcent, Space Grotesk cím-betűtípus). Pontos referencia: a `anyanotesz-demo.jsx` fájl, ami az egyeztetés során véglegesített, kattintható demó.

| Token | Érték |
|---|---|
| Háttér | `#0f1220` |
| Panel | `#171a2b` / `#1e2236` |
| Szegély | `#2a2f47` |
| Szöveg | `#eef0f8` (fő), `#a2a8c3` (másodlagos), `#6f7699` (halvány) |
| Akcent | `#3a6ea5` |
| Zöld / Sárga / Piros | `#37c26b` / `#e0a13a` / `#e0574a` |
| Rózsaszín (szoptatás) | `#e0578f` |
| Cím-betűtípus | Space Grotesk (500/700) |

---

## 13. Következő lépés

Ez a dokumentum a `specifikacio.md` fájl első verziójaként kerül a repóba, a Lapról Lapra mintáját követve. A tényleges fejlesztést Claude Code-nak lépésekre bontva adjuk át (`claude-code-1-lepes-....md` stílusban), miután a GitHub repó és a Supabase/Vercel projekt létrejött.
