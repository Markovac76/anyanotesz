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

Kétszintű, baba-specifikus modell (**admin / user**) egy azon kívül eső, globális **owner**-szereppel.

- **Owner** — globális tulajdonság (`profiles.is_owner`), nem baba-specifikus. Kizárólag közvetlenül Supabase-ben (SQL Editor / Table Editor) állítható be — az appban semmilyen felületen, gombbal vagy API-hívással nem módosítható ("safety switch"). Az owner látja az összes baba összes admin-ját és user-ét (globális áttekintő felület), de a napi adatokhoz (szoptatás, pelenke, súly, stb.) nem fér hozzá, hacsak ő maga is nem regisztrál userként/adminként egy babához, és azt egy admin jóvá nem hagyja — pontosan úgy, mint bárki más. Kivétel: admin nélkül maradt babánál jogosult admin-t kijelölni vagy törölni a babát (lásd lent).
- **Admin** (baba-szintű) — regisztrációkor, ha valaki egy vadonatúj becenevű babát hoz létre, automatikusan admin + approved lesz (nincs jóváhagyási kör, ő az első). Egy admin jóváhagyhatja/elutasíthatja a saját babájához érkező kérelmeket, és léptethet más jóváhagyott user-t is adminná — egy babának lehet több admin-ja is. Egy admin több babához is regisztrálhat/csatlakozhat.
- **User** (baba-szintű) — aki egy már létező becenevű babához regisztrál, userként kerül be, pending státusszal, amíg egy admin jóvá nem hagyja. Egy user is regisztrálhat/csatlakozhat több babához.
- **Baba-választó a fejlécben**: nem a szerepkörtől függ, hanem attól, hogy a usernek hány jóváhagyott baba-tagsága van összesen (bármilyen szerepkörrel) — 2 vagy több esetén aktív.
- **"Legalább egy admin" szabály**: ha egy baba egyetlen admin-ja lemond/kilép, a művelet nincs blokkolva, de egy figyelmeztetés előzi meg. Admin nélkül maradt babánál az owner globális felületén piros jelzés látszik, és az owner onnan tud (a) egy meglévő jóváhagyott user-t adminná kijelölni, vagy (b) törölni a babát.

### Regisztrációs folyamat

1. Regisztrációkor meg kell adni egy **becenevet** a babának (nem a teljes nevet — elgépelés-kockázat csökkentése).
2. Ha van már ilyen becenevű baba a rendszerben → a user csatlakozást kérhet hozzá, **user**+pending státusszal. Egy **admin hagyja jóvá**.
3. Ha nincs ilyen becenevű baba → a user új babát vihet fel (becenév + teljes név), automatikusan **admin**+approved lesz.
4. Amíg a kérelem függőben van, a user egy egyszerű **"Várakozás jóváhagyásra"** képernyőt lát, nem fér hozzá adatokhoz.
5. Az adminnak a **Userek** felületen egy **függőben lévő kérelmek** szekció mutatja a saját babájához érkező kéréseket, jóváhagyó/elutasító gombbal.
6. **Nincs email-értesítés** ehhez (Keep It Simple) — az admin belépéskor látja, ha van függő kérés.

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
-- (baba-szinten csak admin/user létezik — a globális owner a profiles
-- táblában él, lásd 2. pont és supabase/migrations/0005_owner_model.sql)
create table baby_members (
  baby_id uuid references babies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'user' check (role in ('admin','user')),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  primary key (baby_id, user_id)
);

-- Globális owner-flag — kizárólag manuális SQL-lel állítható, nincs hozzá
-- RLS UPDATE policy (lásd 2. pont). Az email egy denormalizált másolat az
-- auth.users-ből (az auth séma nincs kitéve a kliens felé), trigger tartja
-- szinkronban — ez adja a "Userek" felület név-megjelenítését.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_owner boolean not null default false,
  email text,
  created_at timestamptz default now()
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

### 3.1 `babies` tábla — hozzáférés kizárólag RPC-ken keresztül (`0007_lock_babies_select.sql`)

A `babies` tábla SELECT-je szigorúan **csak jóváhagyott tagoknak** nyitott (`is_approved_member(id)`) — sem idegen userek, sem a globális owner nem fér hozzá egy baba teljes sorához (beleértve a bizalmas születési dátumot/helyet/súlyt/hosszt), hacsak nem jóváhagyott tagja. Ez korábban (lásd `0003_fix_babies_select_policy.sql`) nyitva volt mindenkinek egy tyúk-tojás probléma miatt (nickname-keresés + `INSERT...RETURNING` láthatóság, mielőtt a usernek bármilyen tagsága lenne) — ezt most három SECURITY DEFINER RPC váltja ki, mindegyik csak a szükséges minimumot adja vissza:

- **`search_baby_nickname(p_nickname)`** — csak `id, nickname`, a regisztrációs "van-e már ilyen becenevű baba" kereséshez.
- **`create_baby(p_nickname, p_full_name)`** — atomikusan létrehozza a babát ÉS az admin-tagságot egy tranzakcióban (`id, nickname, full_name`-t ad vissza).
- **`owner_babies_overview()`** — csak globális ownernek: minden babát visszaad, de **csak `id, nickname, full_name`** — a bizalmas születési adatok soha nem szerepelnek benne, még az owner globális "Userek" áttekintőjében sem.

Közvetlen kliens-oldali `INSERT` a `babies` táblára nincs (a policy törölve) — új baba kizárólag a `create_baby()` RPC-n keresztül jöhet létre, hogy ne lehessen admin-tagság nélküli "árva" babát csinálni.

**Nickname-egyediség**: `babies_nickname_unique_ci` case-insensitive unique index — ha két user pár másodpercen belül ugyanazzal a becenévvel regisztrál, a versenyhelyzet vesztese (`23505` hibakód) a kliens oldalon automatikusan a most létrejött babához csatlakozik pending user-ként, hibaüzenet helyett.

**Laza range-check-ek** (nem orvosi pontosságú validáció, csak a nyilvánvalóan hibás adat kiszűrése): `weight_measurements.weight_g`, `feedings.weight_before_g`/`weight_after_g`/`extra_milk_ml`/`extra_formula_ml`, `babies.birth_weight_g`/`birth_length_cm` mind DB-szintű `check` constraint-tel védettek (pl. `weight_g > 0 and weight_g < 30000`).

---

## 4. Fejléc és navigáció

- App név: **Anyanotesz**
- Gombok: **Karbantartás**, **Súgó**, **Kilépés** (mindenkinek, aki babához van kötve), **Userek** (owner-eknek és baba-adminoknak)
- **Karbantartás**: baba alapadatok szerkesztése, gyógyszer-sablonok és tevékenység-sablonok kezelése (részletek a 6.6 pontban)
- **Userek**: babánként a saját (admin-i) babák pending kérelmei + tagjai, jóváhagyás/elutasítás/adminná-léptetés gombokkal ("Saját babák"); globális owner-nek emellett egy "Owner nézet" fül minden babával, admin nélkül maradt babák piros jelzésével és vészhelyzeti admin-kijelölés/baba-törlés gombokkal — ez a fül a `owner_babies_overview()` RPC-t hívja, ami **soha nem ad vissza bizalmas születési adatot**, csak becenevet/teljes nevet. Ha az owner-nek nincs egyetlen saját baba-tagsága sem, egyenesen ez a nézet a kezdőképernyője.
- A "gyerek neve" sáv a fejléc alatt: a baba-választó attól függ, hány jóváhagyott baba-tagsága van a usernek (2 vagy több esetén aktív), nem a szerepkörétől.

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
- Bal/Jobb/Mindkettő/**Csak kiegészítés** választó — az utolsó opció akkor kell, ha nem történt tényleges szoptatás, csak anyatej/tápszer kiegészítés adása; ilyenkor a "Súly méréséhez" blokk (a "Nem mérhető most" kapcsolóval és a súly-mezőkkel együtt) el is tűnik, mivel az a szoptatás közbeni lemérésre vonatkozik
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
| Ikrek / 3+ gyerek UX finomítása | A több baba közti váltogatás technikailag megvan (2+ jóváhagyott tagságtól bárkinek), de nincs rá külön kidolgozott folyamat |

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
