# Anyanotesz — Állapot-összefoglaló (2. fázis lezárása)

Ez a dokumentum azért készült, hogy egy **új Claude-beszélgetésben** gyorsan vissza lehessen állni a projekt jelenlegi állapotára, kép/token-limit miatti chatváltás esetén.

## Hol tartunk

A teljes MVP-funkcionalitás **elkészült, élesben fut, és élő adatokkal tesztelve van**. A projekt a tervezési fázisból a "működő, éles alkalmazás apró csiszolásokkal" fázisba lépett.

**Élő URL:** https://anyanotesz.vercel.app
**GitHub repó:** https://github.com/Markovac76/anyanotesz (privát)
**Helyi klón:** `C:\Users\gmarc\OneDrive\MUNKA - Projektek\anyanotesz`
**Vercel projekt:** Markov's Org / anyanotesz
**Supabase projekt:** anyanotesz (Markov Org)

A repóban a **`specifikacio.md`** és **`allapot-osszefoglalo.md`** fájlokat Claude Code menet közben többször is frissítette, hogy tükrözzék a tényleges implementációt — **azok a repóban lévő verziók az elsődleges, hiteles forrás**, nem az itteni chat-előzmény.

## Amit végigcsináltunk és éles teszttel igazoltunk

- ✅ Projektváz: natív ES modulok, build-eszköz nélkül, a Lapról Lapra mintáját követve
- ✅ Supabase séma + RLS minden táblán (babies, baby_members, weight_measurements, feedings, diapers, care_templates, care_logs, questions)
- ✅ Regisztráció, becenév-alapú baba-keresés/létrehozás, owner-jóváhagyási folyamat (első regisztráló automatikusan owner+approved)
- ✅ Szerepkörök: owner / admin / user, Felhasználók-kezelő felület
- ✅ Gyerek-doboz (hero-kártya): születési adatok, aktuális súly, heti gyarapodás zöld/sárga/piros jelzéssel, fallback-logikával, ha még nincs "hét eleje előtti" mérés
- ✅ Mind a négy funkció-doboz: Ruhátlan testsúlymérés, Szoptatás, Pelenkacsere, Egyéb (köldökápolás + gyógyszer-sablonok, napi/heti/havi)
- ✅ Kérdések doboz (címzett + állapot szűrőkkel)
- ✅ Karbantartás oldal: baba alapadatok szerkesztése, gyógyszer-sablonok és tevékenység-sablonok külön listaként, teljes CRUD-dal
- ✅ Historikus adatok oldal: 4 típus (Testsúlymérés, Szoptatás, Pelenkacsere, Egyéb), szűrhető, szerkeszthető, törölhető (kétlépéses megerősítéssel)
- ✅ Grafikonok oldal: Súlygörbe (heti/havi), Szoptatások és Pelenkacserék (napi/heti/havi), saját kézzel épített SVG-diagramokkal (Recharts helyett, mivel nincs build-eszköz)
- ✅ Egykezes UX minden bevitelnél: naptár + görgethető óra dátum/időhöz, felugró számbillentyűzet a súly/ml mezőkhöz
- ✅ PWA: service worker, valódi PNG ikonok, telepíthetőség tesztelve telefonon, offline-induláskezelés
- ✅ Frissítés-kezelés: fejléc-gomb + automatikus alsó sáv, konzisztensen (a korábbi versenyhelyzet-hiba javítva)
- ✅ Vercel deploy, config.js generálása build-időben env változóból (nem kerül git-be)

## Fontos technikai döntések / megoldott buktatók (ne felejtsük el)

1. **`config.js` sosem kerül git-be.** A `vercel.json` `buildCommand`-ja generálja build-időben a `SUPABASE_ANON_KEY` Vercel-környezeti változóból (ugyanaz a minta, mint a Lapról Lapránál). Ha valaha "404 config.js" hibát látunk élesben, ez az első gyanús pont.
2. **Service worker cache-verziózás fegyelme:** minden alkalommal, amikor a `js/` mappában bármi módosul, a `service-worker.js`-ben emelni KELL a `CACHE_NAME` verziószámát — különben a böngésző/telefon a régi, cache-elt kódot szolgálja ki, és "megmagyarázhatatlan" hibák tűnnek fel. Claude Code ezt mostantól automatikusan elvégzi minden kód-módosításnál.
3. **Frissítés-jelzés:** a fejléc "Frissítés" gombja és a service worker automatikus alsó sávja most már egységes, esemény-alapú (nem időzítéses találgatás) logikát használnak (`sw-update.js`).
4. **RLS "tyúk-tojás" probléma:** a `babies` tábla SELECT policy-ja eredetileg csak jóváhagyott tagoknak engedte a láthatóságot, ami elrontotta a becenév-keresést ÉS az új baba létrehozását is (Supabase `.insert().select()` látja kell legyen a friss sor). Megoldás: a `babies` SELECT nyitva van minden bejelentkezett usernek (nem érzékeny adat), csak a napi bejegyzések maradnak jóváhagyott tagsághoz kötve.
5. **Élő telefonos/PWA teszt csak HTTPS-en (Vercelen) lehetséges** — helyi Live Server/localhost nem alkalmas rá.
6. **A heti gyarapodás-számítás** fallback-logikát használ: ha nincs "hét eleje előtti" mérés, a héten belüli legkorábbi mérést veszi alapnak, és ezt jelzi is ("közelítő, kevés adat alapján").

## Nyitva maradt / későbbi fejlesztésre váró pontok

| Terület | Állapot |
|---|---|
| Excel export | "Fejlesztés alatt" placeholder, sem letöltés, sem email nincs implementálva |
| Push notification | Nincs, csak in-app jelzések (pl. köldökápolás, gyógyszer-emlékeztető) |
| Jelszó/kód mező "megmutatás" funkciója | Regisztrációs/bejelentkezési mezőknél nincs "szem-ikon", vakon kell gépelni |
| Ikrek / 3+ gyerek UX | Owner/admin váltogatás technikailag megvan, finomított UX nincs kidolgozva |
| Historikus lista sorrend-javítás | Elkészült: Testsúlymérés / Szoptatás / Pelenkacsere / Egyéb sorrend, igazítva a dashboard dobozaihoz |

## Hogyan folytassuk egy új chatben

Ha új beszélgetést kell nyitni (kép/token-limit miatt), a legegyszerűbb indítás:

> "Van egy anyanotesz nevű projektem (github.com/Markovac76/anyanotesz), amit korábban veled együtt terveztünk és fejlesztettünk Claude Code segítségével. Kérlek olvasd el a repóban lévő `specifikacio.md` és `allapot-osszefoglalo.md` fájlokat, hogy tudd, hol tartunk, és onnantól segíts tovább."

(Ehhez a repót átmenetileg publikussá kell tenni, ahogy eddig is tettük, vagy a fájlokat kézzel be lehet másolni a chatbe.)

## Fájlok, amik ebből a beszélgetésből származnak

| Fájl | Hol van |
|---|---|
| `anyanotesz-specifikacio.md` | Repóban (Claude Code által frissítve, hitelesebb, mint az itteni helyi másolat) |
| `allapot-osszefoglalo.md` | Repóban — ezt a dokumentumot érdemes odamásolni/felváltani vele |
| `anyanotesz-demo.jsx` | Repóban — vizuális/UX referencia, változatlan |
| `claude-code-1-lepes-projekt-alapok.md` | Repóban — historikus, az induló lépés dokumentuma |
