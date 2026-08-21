// Anyanotesz service worker — app-shell cache-first/network-fallback stratégiával.
//
// A gyökérben kell laknia (nem js/ alatt), mert egy service worker alapból
// csak a saját elérési útja alatti scope-ot tudja irányítani — js/-ből
// indítva sose látná/cache-elné a gyökérben lévő index.html-t, styles.css-t
// stb., csak a js/ mappa tartalmát.
//
// Elv:
// - Statikus shell-fájlok (HTML/CSS/JS/manifest/ikonok): cache-first, majd
//   network fallback — offline is betölt az app váza.
// - Supabase API-hívások: SOHA nem megyünk a cache-be, mindig hálózat —
//   így offline állapotban egyértelműen hibázik a kérés (a hívó kód ezt
//   már megjeleníti), ahelyett hogy elavult adatot mutatnánk valós adatként.
// - Frissítés: a CACHE_NAME verziószámát kell növelni, amikor a shell
//   fájllistája vagy tartalma lényegesen változik — ez önmagában is új SW
//   telepítést indít el (a böngésző byte-szinten összehasonlítja ezt a
//   fájlt az előzővel), az main.js-ben lévő regisztráció pedig ekkor
//   értesíti a UI-t ("Új verzió elérhető").

const CACHE_NAME = "anyanotesz-shell-v9";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.json",
  "/config.js",
  "/js/main.js",
  "/js/sw-update.js",
  "/js/state.js",
  "/js/render.js",
  "/js/session.js",
  "/js/auth.js",
  "/js/data.js",
  "/js/supabase-client.js",
  "/js/history.js",
  "/js/history-page.js",
  "/js/charts.js",
  "/js/graphs-page.js",
  "/js/maintenance-page.js",
  "/js/hero-card.js",
  "/js/function-cards.js",
  "/js/fields.js",
  "/js/datetime-picker.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Szándékosan NINCS self.skipWaiting() itt — amíg a user nem kattint a
  // "Frissítés" gombra (lásd main.js), a régi SW marad aktív, hogy ne
  // szakítsa félbe véletlenül a folyamatban lévő használatot.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSupabaseRequest(url) {
  return url.hostname.endsWith(".supabase.co");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Csak GET-eket kezelünk — a Supabase írások (POST/PATCH/DELETE) úgyis
  // csak hálózaton mehetnek, ezeket békén hagyjuk.
  if (event.request.method !== "GET") return;

  // Supabase API-hívások (adatok): mindig hálózat, sosem cache.
  if (isSupabaseRequest(url)) return;

  // Csak a saját origin statikus fájljait cache-eljük — a Google Fonts CDN-t
  // (más origin) nem, az nem kritikus az app-kerethez.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline, és ez a fájl nincs cache-elve (pl. új route) — navigációs
          // kéréseknél essünk vissza az index.html-re, hogy legalább az
          // app-keret betöltsön, ne törött oldal jelenjen meg.
          if (event.request.mode === "navigate") return caches.match("/index.html");
          return Response.error();
        });
    })
  );
});

// A "Frissítés" gomb (main.js) ezzel az üzenettel mondja meg a várakozó SW-nek,
// hogy vegye át azonnal az irányítást.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
