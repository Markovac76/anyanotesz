// Egyszerű app-szintű állapotkezelés (pub-sub), build-eszköz és keretrendszer nélkül.

const state = {
  status: "loading", // loading | boot-error | auth | pending | needs-baby | dashboard
  bootError: null, // induláskori hiba szövege (pl. nincs internetkapcsolat) | null
  session: null,
  authMode: "login", // login | register
  authError: null,
  authBusy: false,

  // regisztrációkor: a becenévhez tartozó meglévő baba, ha van
  registerFoundBaby: null,

  // a bejelentkezett userhez tartozó jóváhagyott baba-tagságok
  memberships: [], // [{ baby, role, status }]
  activeBabyId: null,
  babyPickerOpen: false,

  // a bejelentkezett user MÁSIK babákhoz küldött, még jóvá nem hagyott
  // kérelmei — a baba-választóban egy nem-kattintható, "(várakozás
  // jóváhagyásra)" feliratú sorként jelennek meg. Szándékosan külön
  // mezőben, nem a memberships-ben, hogy a memberships-re épülő meglévő
  // logika (aktív baba, admin-ellenőrzés, stb.) ne kelljen státusz szerint
  // szűrögetni mindenhol.
  pendingMemberships: [], // [{ baby, role, status }]

  // globális owner-e (profiles.is_owner) — kizárólag manuális SQL-lel
  // állítható, lásd 0005_owner_model.sql. Nem baba-specifikus.
  isOwner: false,

  // baba-szintű admin: függőben lévő kérelmek a saját babáihoz
  pendingRequests: [],

  // "Userek" oldal: a két fül külön forrásból dolgozik (lásd
  // 0007_lock_babies_select.sql) — "own" a hívó saját (jóváhagyott)
  // babáit adja vissza a nyers babies-select policy alapján, "owner" az
  // owner_babies_overview() RPC-n keresztül MINDEN babát, de bizalmas
  // születési adatok nélkül.
  usersOverviewOwn: null, // [{ id, nickname, full_name, baby_members: [...] }] | null
  usersOverviewOwner: null, // [{ id, nickname, full_name, baby_members: [...] }] | null
  usersOverviewTab: "own", // "own" | "owner" — csak ha isOwner és van saját tagsága is

  // Gyerek-doboz (mindig látható infósáv, 5. pont): baba alapadatok,
  // legutóbbi súlymérés, a hét eleje előtti súly a gyarapodás-számításhoz.
  babyInfo: null, // { baby, latestWeight, weekBaselineWeight, weekStart } | null

  // funkció-dobozok nyitott/csukott állapota
  weightOpen: true,
  feedOpen: true,
  diaperOpen: true,
  otherOpen: true,

  // "Egyéb" doboz: ismétlődő teendők sablonjai és a legutóbbi naplózásaik
  // (ugyanezt a listát használja a Karbantartás oldal két sablon-listája is)
  careTemplates: [], // [{ id, name, frequency, category }]
  careLogs: [], // [{ id, template_id, done_at }]

  // "Kérdések" doboz
  questionsOpen: true,
  questions: [], // [{ id, text, recipient, answer, answered, created_at }]

  // Dashboard vs. Historikus adatok / Grafikonok / Karbantartás / Userek / Súgó / baba hozzáadása oldal
  view: "dashboard", // dashboard | history | graphs | maintenance | users | help | add-baby
  historyEntries: [],
  historyFilters: { feed: true, diaper: true, other: true, weight: true },
  historyEditing: null, // { type, id } | null
  graphsData: null, // { weightSeries, feedingTimes, diaperEvents, growth } | null
  maintenanceBaby: null, // a babies tábla teljes sora, szerkesztéshez | null

  // Általános "fejlesztés alatt" infó-modal (Grafikonok, Excel export)
  infoModal: null, // { title, message } | null

  // PWA: új service worker verzió elérhető, "Frissítés" sáv megjelenítéséhez
  updateAvailable: false,
  waitingWorker: null, // a várakozó (még nem aktivált) service worker | null
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
