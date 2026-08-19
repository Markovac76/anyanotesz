# Anyanotesz — Állapot-összefoglaló

**Utolsó frissítés:** tervezési fázis lezárva, kódolás előtt

## Hol tartunk

- A specifikáció (`specifikacio.md`) v1.0 verziója kész és jóváhagyott.
- A vizuális/interakciós referencia egy kattintható React demó (`anyanotesz-demo.jsx`), amit Claude-dal közösen alakítottunk ki, mock adatokkal. Ez a végleges design token-készlet és UX-minta forrása — a Lapról Lapra vizuális stílusát követi (sötét téma, kék akcent, Space Grotesk).
- **Kódolás még nem kezdődött el.** A tényleges implementáció (Supabase séma, auth, valódi UI) még nincs lefejlesztve — a demó pusztán mock adatokkal működő prototípus, nem éles kód.

## Következő lépés

Az első Claude Code lépésfájl (`claude-code-1-lepes-....md`) elkészítése, ami a projekt inicializálásától indul: Next.js/vanilla JS projekt setup (a Lapról Lapra mintájára build-eszköz nélküli natív ES modulokkal), majd a Supabase séma migrációk, az auth/jóváhagyási logika, és a demóban látott UI lekódolása lépésről lépésre.

## Ismert nyitott pont

- A **Karbantartás** gomb tartalma egyelőre "Fejlesztés alatt" placeholder — funkcióját külön körben tervezzük meg, nem blokkolja az MVP indulását.
- Az **Excel export → email küldés** szintén későbbi fejlesztés; a letöltős export az MVP része.

## Fájlok ebben a repóban

| Fájl | Tartalom |
|---|---|
| `specifikacio.md` | Teljes funkcionális + adatmodell specifikáció (v1.0) |
| `anyanotesz-demo.jsx` | Kattintható vizuális/UX referencia (React, mock adatokkal) |
| `allapot-osszefoglalo.md` | Ez a fájl |
