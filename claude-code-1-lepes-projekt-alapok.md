# Claude Code — 1. lépés: projekt alapok + Supabase séma + auth

Ezt a fájlt másold be egyben Claude Code-nak (terminálban vagy a Claude Code desktop appban), a repó gyökerében állva.

---

## Kontextus Claude Code-nak

Ebben a repóban két referencia-dokumentum van:
- `specifikacio.md` — a teljes funkcionális és adatmodell specifikáció
- `anyanotesz-demo.jsx` — egy React demó, ami a VÉGLEGES vizuális stílust és UX-mintákat mutatja (színek, betűtípus, elrendezés, interakciók). **Ez a demó React/Tailwind-ben készült, csak referenciának — a tényleges projekt build-eszköz nélküli, natív ES modulokra épül (lásd lent), szóval a demóból a design tokeneket és a viselkedést vedd át, ne magát a React-kódot.**

Kérlek, először olvasd el mindkét fájlt, mielőtt bármit létrehozol.

---

## Feladat

### 1. Projekt inicializálás

Hozz létre egy build-eszköz nélküli, natív ES modulokra épülő projektet, az alábbi struktúrával:

```
/
├── index.html
├── styles.css
├── config.example.js       (env változók sablonja, git-ben)
├── .gitignore               (config.js kizárva)
├── manifest.json            (PWA)
├── icons/                   (PWA ikonok)
└── js/
    ├── main.js               (belépési pont)
    ├── supabase-client.js     (Supabase kliens inicializálás)
    ├── auth.js                (bejelentkezés, regisztráció, jóváhagyási logika)
    ├── state.js               (app-szintű állapotkezelés)
    ├── data.js                (Supabase lekérdezések: babies, feedings, diapers, stb.)
    ├── render.js              (DOM renderelés)
    └── datetime-picker.js     (a demóban látott naptár + görgethető óra komponens)
```

A `styles.css`-ben vedd át a demó design tokenjeit CSS custom property-ként:

```css
:root {
  --bg: #0f1220;
  --panel: #171a2b;
  --panel-2: #1e2236;
  --line: #2a2f47;
  --ink: #eef0f8;
  --muted: #a2a8c3;
  --faint: #6f7699;
  --accent: #3a6ea5;
  --green: #37c26b;
  --amber: #e0a13a;
  --red: #e0574a;
  --pink: #e0578f;
}
```
Cím-betűtípus: Space Grotesk (Google Fonts importtal).

### 2. Supabase séma

A `specifikacio.md` 3. fejezetében ("Adatmodell") található SQL-t másold be egy `supabase/migrations/0001_init.sql` fájlba, változtatás nélkül. Ezután írj hozzá **Row Level Security policy-kat** minden táblához, az alábbi elv szerint:

- Egy user csak azokhoz a sorokhoz fér hozzá (SELECT/INSERT/UPDATE/DELETE), amelyek `baby_id`-ja szerepel a `baby_members` táblában az ő `user_id`-jával és `status = 'approved'` értékkel.
- Kivétel a `baby_members` tábla saját magára: egy user lássa a saját sorait (bármilyen status), az owner/admin pedig az összes sort a hozzá tartozó babákhoz.

### 3. Auth + regisztrációs/jóváhagyási folyamat

Implementáld a `specifikacio.md` 2. fejezetében leírt folyamatot:

1. Email + jelszó regisztráció (Supabase Auth).
2. Regisztráció után a user megadja a baba **becenevét**.
3. Ha van ilyen becenevű, `approved` állapotú baba → a rendszer létrehoz egy `baby_members` sort `status = 'pending'`-del, és a usernek egy "Várakozás jóváhagyásra" képernyőt mutat.
4. Ha nincs ilyen becenevű baba → a user megadhatja a baba teljes nevét is, létrejön egy új `babies` sor, és a userhez egy `baby_members` sor `role = 'owner'`, `status = 'pending'` értékkel (az első regisztráló automatikusan owner lesz, de a jóváhagyás elve akkor is érvényesül — erről lásd az alábbi megjegyzést).
5. Owner felület: egy egyszerű lista a `pending` státuszú `baby_members` sorokról a hozzá tartozó babák esetén, jóváhagyó/elutasító gombbal.

**Megjegyzés, amit vess fel nekem, mielőtt implementálod:** mi történjen az ELSŐ regisztrálóval egy vadonatúj babánál — ő legyen automatikusan `approved` + `owner` (hiszen nincs ki jóváhagyja), és csak a MÁSODIK (és további) csatlakozó user esetén kelljen jóváhagyás? Ez logikusnak tűnik, de kérlek erősítsd meg, mielőtt belekódolod.

### 4. Belépés utáni alapváz

Egy minimális, üres dashboard oldal, ami:
- Betölti a bejelentkezett userhez tartozó, jóváhagyott babá(ka)t
- Megjeleníti a fejlécet (Anyanotesz cím, Karbantartás/Súgó/Kilépés gombok — egyelőre funkció nélkül, csak UI)
- A gyerek nevét mutatja (user esetén fixen, owner/admin esetén választóval, ha több babája van)

**Ezen a ponton állj meg, és kérj visszajelzést, mielőtt a funkció-dobozok (szoptatás, pelenkacsere stb.) lekódolásába kezdenél.**

---

## Amit NEM kérek ebben a lépésben

- A funkció-dobozok (szoptatás, pelenkacsere, egyéb, kérdések) tartalma
- Historikus adatok oldal
- Grafikonok
- PWA finomítások (service worker) — a manifest.json-t elég előkészíteni, a service workert egy későbbi lépésben kérem
