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

  // owner/admin: függőben lévő kérelmek a saját babáihoz
  pendingRequests: [],

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

  // Dashboard vs. Historikus adatok / Grafikonok / Karbantartás oldal
  view: "dashboard", // dashboard | history | graphs | maintenance
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
