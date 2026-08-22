# Anyanotesz — Állapot-összefoglaló (3. fázis lezárása)

Ez a dokumentum azért készült, hogy egy **új Claude-beszélgetésben** gyorsan vissza lehessen állni a projekt jelenlegi állapotára, kép/token-limit miatti chatváltás esetén.

## Hol tartunk

A teljes MVP-funkcionalitás **elkészült, élesben fut, két valós felhasználóval (owner + egy admin/user) tesztelve van**, és a jogosultsági rendszer egy jelentős, éles adatbázison végrehajtott átalakításon is átesett. A projekt "stabil, éles alkalmazás, apró csiszolásokkal" állapotban van.

**Élő URL:** https://anyanotesz.vercel.app
**GitHub repó:** https://github.com/Markovac76/anyanotesz (privát — csak akkor tedd publikussá, ha Claude-nak olvasnia kell belőle valamit, utána állítsd vissza privátra)
**Helyi klón:** `C:\Users\gmarc\OneDrive\MUNKA - Projektek\anyanotesz`
**Vercel projekt:** Markov's Org / anyanotesz
**Supabase projekt:** anyanotesz (Markov Org)

A repóban a **`anyanotesz-specifikacio.md`** fájlt Claude Code menet közben mindig frissíti, hogy tükrözze a tényleges implementációt — **az a repóban lévő verzió az elsődleges, hiteles forrás**. A korábbi `allapot-osszefoglalo.md` és `anyanotesz-allapot-osszefoglalo-v2.md` fájlokat töröltük a repóból (elavultak voltak) — ez a dokumentum (`-v3`) az érvényes, naprakész összefoglaló.

## Amit végigcsináltunk és éles teszttel igazoltunk

- ✅ Projektváz: natív ES modulok, build-eszköz nélkül, a Lapról Lapra mintáját követve
- ✅ Supabase séma + RLS minden táblán (babies, baby_members, profiles, weight_measurements, feedings, diapers, care_templates, care_logs, questions)
- ✅ Regisztráció, becenév-alapú baba-keresés/létrehozás
- ✅ **Jogosultsági rendszer (2. körben teljesen átalakítva)** — lásd külön szakasz lent
- ✅ Gyerek-doboz (hero-kártya): születési adatok, aktuális súly, heti gyarapodás zöld/sárga/piros jelzéssel; ha nincs "hét eleje előtti" mérés, a rendszer nem közelít, hanem jelzi, hogy egyelőre nincs elég adat a számításhoz
- ✅ Mind a négy funkció-doboz: Ruhátlan testsúlymérés, Szoptatás (Bal/Jobb/Mindkettő/Csak kiegészítés választóval), Pelenkacsere, Egyéb (köldökápolás + gyógyszer-sablonok, napi/heti/havi)
- ✅ Kérdések doboz (címzett + állapot szűrőkkel)
- ✅ Karbantartás oldal: baba alapadatok szerkesztése, gyógyszer-sablonok és tevékenység-sablonok külön listaként, teljes CRUD-dal
- ✅ Historikus adatok oldal: 4 típus (Testsúlymérés, Szoptatás, Pelenkacsere, Egyéb), szűrhető, szerkeszthető, törölhető (kétlépéses megerősítéssel)
- ✅ Grafikonok oldal: Súlygörbe (heti/havi), Szoptatások és Pelenkacserék (napi/heti/havi), saját kézzel épített SVG-diagramokkal (Recharts helyett, mivel nincs build-eszköz)
- ✅ Egykezes UX minden bevitelnél: naptár + görgethető óra dátum/időhöz, felugró számbillentyűzet a súly/ml mezőkhöz
- ✅ Jelszó "megmutatás" funkció (szem-ikon) bejelentkezésnél és regisztrációnál is
- ✅ Súgó oldal: 12 összecsukható szekció, minden funkció szöveges magyarázatával
- ✅ PWA: service worker, valódi PNG ikonok, telepíthetőség tesztelve telefonon, offline-induláskezelés
- ✅ Frissítés-kezelés: fejléc-gomb + automatikus alsó sáv, konzisztensen (a korábbi versenyhelyzet-hiba javítva)
- ✅ Vercel deploy, config.js generálása build-időben env változóból (nem kerül git-be — mostantól a `SUPABASE_URL` is env-változó, lásd lent)
- ✅ **Code-review kör (4. lépés)** — lásd külön szakasz lent: `babies` tábla adatszivárgás javítva RPC-kre való átállással, nickname-ütközés és numerikus range-check védelem DB-szinten, Grafikonok oldal csendes adat-levágásának javítása, `alert()` hívások lecserélve inline hibamegjelenítésre
- ✅ **"Másik baba hozzáadása" (5. lépés)** — egy már jóváhagyott admin/user a fejléc baba-választójából ("+ Másik baba hozzáadása") bejelentkezett állapotban is felvehet/kérhet egy második (harmadik, stb.) babát, anélkül hogy a globális app-állapotot "várakozás jóváhagyásra"-ra állítaná — lásd külön szakasz lent

## A jogosultsági rendszer (fontos, mert menet közben teljesen átalakult)

Az eredeti terv (egyszerű owner/admin/user hierarchia babánként) helyett most ez fut élesben:

- **Owner** — globális, nem baba-specifikus tulajdonság (`profiles.is_owner`). **Kizárólag Supabase-ben, kézzel állítható be** — az appban semmilyen felületen nem módosítható (tudatos "safety switch"). Jelenleg egyedül `g.marcell.kovacs@gmail.com` az owner. Az owner látja az **összes baba összes admin-ját és user-ét** egy globális "Owner nézet" fülön, de **nem fér hozzá egyetlen baba napi adataihoz SEM a bizalmas születési adataihoz** (dátum, hely, súly, hossz), hacsak ő maga is nem regisztrál oda és egy admin jóvá nem hagyja — kivéve admin nélkül maradt babánál, ahol vészhelyzeti jogköre van (admin kijelölése vagy a baba törlése).
- **Admin** (baba-szintű) — aki elsőként regisztrál egy új becenevű babát, automatikusan admin+approved lesz. Egy admin jóváhagy/elutasít, és léptethet más usert is adminná (egy babának lehet több admin-ja).
- **User** (baba-szintű) — aki egy már létező babához csatlakozik, pending státusszal vár admin-jóváhagyásra.
- **Baba-váltó gomb** a fejlécben: mindig kattintható (nem szerepkörtől vagy tagságszámtól függ) — "+ Másik baba hozzáadása" sorral és a pending kérelmek "(várakozás jóváhagyásra)" jelzésével (5. lépés).
- **"Legalább egy admin" szabály**: ha az utolsó admin lemondana/kilépne, ez nincs blokkolva, csak figyelmeztet — az admin nélkül maradt babát az owner globális nézete piros jelzéssel mutatja.

**Technikai megvalósítás:** `baby_members.role` mostantól csak `('admin','user')`; új `profiles` tábla (`is_owner` boolean, `email` — utóbbi egy auth.users-ből triggerrel szinkronizált denormalizált mező, mert az auth séma nem érhető el kliensből, és a Userek felület emailt jelenít meg, nem nyers user_id-t). Migrációk: `0005_owner_model.sql`, `0006_profile_emails.sql`.

**4. lépés (code review) óta:** a `babies` tábla SELECT-je szigorúan csak jóváhagyott tagoknak nyitott (`0007_lock_babies_select.sql`) — korábban minden bejelentkezett user (és az owner is) hozzáférhetett bármelyik baba teljes sorához, beleértve a bizalmas születési adatokat. Ezt három SECURITY DEFINER RPC váltja ki: `search_baby_nickname()` (regisztrációs kereséshez, csak id+nickname), `create_baby()` (atomikusan hozza létre a babát+admin-tagságot), `owner_babies_overview()` (owner globális nézetéhez, csak id+nickname+full_name, SOHA nem ad vissza születési adatot). Közvetlen kliens-oldali `INSERT` a `babies` táblára nincs többé. Emellett: case-insensitive nickname-egyediség (`babies_nickname_unique_ci`) + versenyhelyzet-kezelés kliens oldalon (23505 hibakód → automatikus csatlakozás a race-győztes babához), és laza DB-szintű range-check-ek a numerikus mezőkön (súly, ml, stb.).

**5. lépés ("Másik baba hozzáadása") óta:** a fejléc baba-választója mindig kattintható (nem csak 2+ tagságnál), és egy "+ Másik baba hozzáadása" sort mutat, ami egy új `view: "add-baby"` nézetet nyit (közös lépés-logika a `js/baby-step-shared.js`-ben, ugyanaz, mint az első regisztrációnál). Menet közben derült ki egy apró mellékhatás a 4. lépés RLS-szigorításából: egy PENDING (még jóvá nem hagyott) tagságnál a `baby_members.baby:babies(...)` beágyazott lekérdezés `null`-t adott vissza (a user még nem approved tag, a `babies_select_members` policy kizárja) — ezt egy új, minimális RPC-vel (`my_membership_baby_names()`, `0008_pending_baby_names.sql`) oldottuk fel: a hívó saját, bármilyen státuszú tagságai alapján adja vissza a nicknevet, más adathoz nem enged hozzáférést.

## Fontos technikai döntések / megoldott buktatók (ne felejtsük el)

1. **`config.js` sosem kerül git-be.** A `vercel.json` `buildCommand`-ja generálja build-időben a `SUPABASE_URL` és `SUPABASE_ANON_KEY` Vercel-környezeti változókból (mindkettő kötelező, a build hard-fail-el, ha bármelyik hiányzik) — ellenőrizd, hogy mindkettő be van-e állítva a Vercel projekt Settings → Environment Variables alatt.
2. **Service worker cache-verziózás fegyelme:** minden alkalommal, amikor a `js/` mappában bármi módosul, a `service-worker.js`-ben emelni KELL a `CACHE_NAME` verziószámát — Claude Code ezt már automatikusan elvégzi.
3. **Frissítés-jelzés:** a fejléc "Frissítés" gombja és a service worker automatikus alsó sávja egységes, esemény-alapú logikát használnak (`sw-update.js`) — korábban egy versenyhelyzet miatt ellentmondtak egymásnak, ez javítva.
4. **RLS "tyúk-tojás" problémák** időnként előjönnek új funkciónál (pl. a `babies` SELECT policy eredetileg elrontotta a becenév-keresést). Ha "row-level security policy violation" hibát látsz, ez az első gyanús pont — kérd meg Claude Code-ot, hogy nézze át az adott tábla policy-jait.
5. **Élő telefonos/PWA teszt csak HTTPS-en (Vercelen) lehetséges** — helyi Live Server/localhost nem alkalmas rá.
6. **A heti gyarapodás-számítás** szigorú: kizárólag az előző hét utolsó mérését fogadja el kiindulási súlynak. Ha ilyen mérés nincs, nem közelít (nem a héten belüli legkorábbi mérést veszi alapnak), hanem "egyelőre nincs elég adat" üzenetet mutat.
7. **Éles adatbázis-migráció előtt** (mint a jogosultsági átalakításnál) érdemes megkérni Claude Code-ot, hogy előbb csak **összegezze a tervezett SQL-t és RLS-változást**, és várja meg a jóváhagyást, mielőtt lefuttatja — ez bevált gyakorlat, folytassuk így a jövőben is nagyobb változtatásoknál. Biztonsági mentést is szokott készíteni (`db-backups/` mappa) ilyenkor.
8. **Hibamegjelenítés:** natív `alert()` helyett mindenhol a `js/ui-helpers.js`-ben lévő `showInlineError(container, message)`-t használjuk — új helyen felmerülő hibánál ezt hívjuk, ne írjunk új `alert()`-et.

## Nyitva maradt / későbbi fejlesztésre váró pontok

| Terület | Állapot |
|---|---|
| Excel export | "Fejlesztés alatt" placeholder, sem letöltés, sem email nincs implementálva |
| Push notification | Nincs, csak in-app jelzések (pl. köldökápolás, gyógyszer-emlékeztető) |

## Hogyan folytassuk egy új chatben

Ha új beszélgetést kell nyitni (kép/token-limit miatt), a legegyszerűbb indítás:

> "Van egy anyanotesz nevű projektem (github.com/Markovac76/anyanotesz), amit korábban veled együtt terveztünk és fejlesztettünk Claude Code segítségével. A projekt-fájljaim között megtalálod a specifikációt és ezt az állapot-összefoglalót — kérlek olvasd el őket, hogy tudd, hol tartunk, és onnantól segíts tovább."

Ha a projekt-fájlok között nincs meg valamelyik, a repó fájljait Claude Code-dal kérheted ki (írd ki chatbe a tartalmukat), vagy ideiglenesen tedd publikussá a repót.

## Fájlok, amik ebből a beszélgetésből származnak

| Fájl | Hol van |
|---|---|
| `anyanotesz-specifikacio.md` | Repóban (Claude Code által folyamatosan frissítve — ez a hiteles forrás) |
| `anyanotesz-allapot-osszefoglalo-v3.md` | Ez a dokumentum — érdemes feltölteni a Projekt-fájlok közé és a repóba is |
| `anyanotesz-demo.jsx` | Repóban — vizuális/UX referencia, változatlan |
| `claude-code-1-lepes-projekt-alapok.md` | Repóban — historikus, az induló lépés dokumentuma |
