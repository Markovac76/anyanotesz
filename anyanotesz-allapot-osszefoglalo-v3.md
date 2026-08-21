# Anyanotesz — Állapot-összefoglaló (3. fázis lezárása)

Ez a dokumentum azért készült, hogy egy **új Claude-beszélgetésben** gyorsan vissza lehessen állni a projekt jelenlegi állapotára, kép/token-limit miatti chatváltás esetén.

## Hol tartunk

A teljes MVP-funkcionalitás **elkészült, élesben fut, két valós felhasználóval (owner + egy admin/user) tesztelve van**, és a jogosultsági rendszer egy jelentős, éles adatbázison végrehajtott átalakításon is átesett. A projekt "stabil, éles alkalmazás, apró csiszolásokkal" állapotban van.

**Élő URL:** https://anyanotesz.vercel.app
**GitHub repó:** https://github.com/Markovac76/anyanotesz (privát — csak akkor tedd publikussá, ha Claude-nak olvasnia kell belőle valamit, utána állítsd vissza privátra)
**Helyi klón:** `C:\Users\gmarc\OneDrive\MUNKA - Projektek\anyanotesz`
**Vercel projekt:** Markov's Org / anyanotesz
**Supabase projekt:** anyanotesz (Markov Org)

A repóban a **`anyanotesz-specifikacio.md`** fájlt Claude Code menet közben mindig frissíti, hogy tükrözze a tényleges implementációt — **az a repóban lévő verzió az elsődleges, hiteles forrás**. A sima `allapot-osszefoglalo.md` (kötőjel nélküli, régi) a repóban **elavult** (kódolás-előtti állapotot mutat) — ha még nem törölted, érdemes megtenni; ez a dokumentum (`-v3`) a helyette érvényes, naprakész összefoglaló.

## Amit végigcsináltunk és éles teszttel igazoltunk

- ✅ Projektváz: natív ES modulok, build-eszköz nélkül, a Lapról Lapra mintáját követve
- ✅ Supabase séma + RLS minden táblán (babies, baby_members, profiles, weight_measurements, feedings, diapers, care_templates, care_logs, questions)
- ✅ Regisztráció, becenév-alapú baba-keresés/létrehozás
- ✅ **Jogosultsági rendszer (2. körben teljesen átalakítva)** — lásd külön szakasz lent
- ✅ Gyerek-doboz (hero-kártya): születési adatok, aktuális súly, heti gyarapodás zöld/sárga/piros jelzéssel, fallback-logikával, ha még nincs "hét eleje előtti" mérés
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
- ✅ Vercel deploy, config.js generálása build-időben env változóból (nem kerül git-be)

## A jogosultsági rendszer (fontos, mert menet közben teljesen átalakult)

Az eredeti terv (egyszerű owner/admin/user hierarchia babánként) helyett most ez fut élesben:

- **Owner** — globális, nem baba-specifikus tulajdonság (`profiles.is_owner`). **Kizárólag Supabase-ben, kézzel állítható be** — az appban semmilyen felületen nem módosítható (tudatos "safety switch"). Jelenleg egyedül `g.marcell.kovacs@gmail.com` az owner. Az owner látja az **összes baba összes admin-ját és user-ét** egy globális "Owner nézet" fülön, de **nem fér hozzá egyetlen baba napi adataihoz sem**, hacsak ő maga is nem regisztrál oda és egy admin jóvá nem hagyja — kivéve admin nélkül maradt babánál, ahol vészhelyzeti jogköre van (admin kijelölése vagy a baba törlése).
- **Admin** (baba-szintű) — aki elsőként regisztrál egy új becenevű babát, automatikusan admin+approved lesz. Egy admin jóváhagy/elutasít, és léptethet más usert is adminná (egy babának lehet több admin-ja).
- **User** (baba-szintű) — aki egy már létező babához csatlakozik, pending státusszal vár admin-jóváhagyásra.
- **Baba-váltó gomb** a fejlécben: nem szerepkörtől függ, hanem attól, hogy a usernek hány jóváhagyott baba-tagsága van (2+ esetén aktív).
- **"Legalább egy admin" szabály**: ha az utolsó admin lemondana/kilépne, ez nincs blokkolva, csak figyelmeztet — az admin nélkül maradt babát az owner globális nézete piros jelzéssel mutatja.

**Technikai megvalósítás:** `baby_members.role` mostantól csak `('admin','user')`; új `profiles` tábla (`is_owner` boolean, `email` — utóbbi egy auth.users-ből triggerrel szinkronizált denormalizált mező, mert az auth séma nem érhető el kliensből, és a Userek felület emailt jelenít meg, nem nyers user_id-t). Migrációk: `0005_owner_model.sql`, `0006_profile_emails.sql`.

## Fontos technikai döntések / megoldott buktatók (ne felejtsük el)

1. **`config.js` sosem kerül git-be.** A `vercel.json` `buildCommand`-ja generálja build-időben a `SUPABASE_ANON_KEY` Vercel-környezeti változóból.
2. **Service worker cache-verziózás fegyelme:** minden alkalommal, amikor a `js/` mappában bármi módosul, a `service-worker.js`-ben emelni KELL a `CACHE_NAME` verziószámát — Claude Code ezt már automatikusan elvégzi.
3. **Frissítés-jelzés:** a fejléc "Frissítés" gombja és a service worker automatikus alsó sávja egységes, esemény-alapú logikát használnak (`sw-update.js`) — korábban egy versenyhelyzet miatt ellentmondtak egymásnak, ez javítva.
4. **RLS "tyúk-tojás" problémák** időnként előjönnek új funkciónál (pl. a `babies` SELECT policy eredetileg elrontotta a becenév-keresést). Ha "row-level security policy violation" hibát látsz, ez az első gyanús pont — kérd meg Claude Code-ot, hogy nézze át az adott tábla policy-jait.
5. **Élő telefonos/PWA teszt csak HTTPS-en (Vercelen) lehetséges** — helyi Live Server/localhost nem alkalmas rá.
6. **A heti gyarapodás-számítás** fallback-logikát használ: ha nincs "hét eleje előtti" mérés, a héten belüli legkorábbi mérést veszi alapnak ("közelítő, kevés adat alapján" jelzéssel).
7. **Éles adatbázis-migráció előtt** (mint a jogosultsági átalakításnál) érdemes megkérni Claude Code-ot, hogy előbb csak **összegezze a tervezett SQL-t és RLS-változást**, és várja meg a jóváhagyást, mielőtt lefuttatja — ez bevált gyakorlat, folytassuk így a jövőben is nagyobb változtatásoknál. Biztonsági mentést is szokott készíteni (`db-backups/` mappa) ilyenkor.

## Nyitva maradt / későbbi fejlesztésre váró pontok

| Terület | Állapot |
|---|---|
| Excel export | "Fejlesztés alatt" placeholder, sem letöltés, sem email nincs implementálva |
| Push notification | Nincs, csak in-app jelzések (pl. köldökápolás, gyógyszer-emlékeztető) |
| Ikrek / 3+ gyerek UX finomítása | A baba-váltó technikailag megvan (2+ jóváhagyott tagságtól bárkinek), de nincs rá külön kidolgozott folyamat |

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
