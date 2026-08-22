// Session-átmenetek: eldönti, hogy egy (friss vagy visszatérő) bejelentkezés
// után melyik képernyőt kell mutatni, és betölti hozzá a szükséges adatokat.
import { supabase } from "./supabase-client.js";
import { getState, setState } from "./state.js";
import { resolveUserStatus, loadPendingRequests } from "./auth.js";
import {
  ensureDefaultCareTemplates, getRecentCareLogs, getQuestions, getBaby,
  getLatestWeightMeasurement, getLastWeightMeasurementInRange,
  getMyProfile, getOwnBabiesOverview, getOwnerBabiesOverview, getMyMemberships,
} from "./data.js";
import { getHistoryEntries } from "./history.js";
import { getWeightSeries, getFeedingTimes, getDiaperEvents, getBabyGrowthInfo } from "./charts.js";

export async function enterSession(session) {
  setState({ session });

  const [profile, result] = await Promise.all([
    getMyProfile(session.user.id),
    resolveUserStatus(session.user.id),
  ]);
  const isOwner = !!profile?.is_owner;
  setState({ isOwner });

  if (result.status === "dashboard") {
    const memberships = result.memberships;
    const adminBabyIds = memberships.filter((m) => m.role === "admin").map((m) => m.baby.id);
    const pendingRequests = adminBabyIds.length > 0 ? await loadPendingRequests(adminBabyIds) : [];
    const activeBabyId = memberships[0].baby.id;
    setState({
      status: "dashboard",
      memberships,
      pendingMemberships: result.pending,
      activeBabyId,
      pendingRequests,
      view: "dashboard",
    });
    await Promise.all([refreshCareData(activeBabyId), refreshQuestions(activeBabyId), refreshBabyInfo(activeBabyId)]);
    return;
  }

  if (result.status === "pending") {
    setState({ status: "pending" });
    return;
  }

  // Globális owner-nek, akinek nincs egyetlen jóváhagyott (vagy függőben
  // lévő) baba-tagsága sem, nincs saját dashboardja, amit mutathatnánk —
  // egyenesen a globális Userek/owner-áttekintőre landol.
  if (isOwner) {
    setState({
      status: "dashboard",
      memberships: [],
      activeBabyId: null,
      pendingRequests: [],
      view: "users",
      usersOverviewTab: "owner",
    });
    await openUsers();
    return;
  }

  setState({ status: "needs-baby" });
}

export async function refreshPendingRequests() {
  const st = getState();
  const adminBabyIds = st.memberships.filter((m) => m.role === "admin").map((m) => m.baby.id);
  const pendingRequests = adminBabyIds.length > 0 ? await loadPendingRequests(adminBabyIds) : [];
  setState({ pendingRequests });
}

// "Userek" oldal megnyitása/bezárása. A két fül mostantól külön forrásból
// dolgozik (lásd 0007_lock_babies_select.sql): a "Saját babák" a nyers
// babies-select policy alapján magától is csak a hívó saját (jóváhagyott)
// babáit adja vissza; az "Owner nézet" az owner_babies_overview() RPC-t
// hívja, ami minden babát visszaad, de bizalmas születési adatok nélkül.
export async function openUsers() {
  setState({ view: "users" });
  const st = getState();
  const isBabyAdmin = st.memberships.some((m) => m.role === "admin");

  const [usersOverviewOwn, usersOverviewOwner] = await Promise.all([
    isBabyAdmin ? getOwnBabiesOverview() : Promise.resolve(null),
    st.isOwner ? getOwnerBabiesOverview() : Promise.resolve(null),
  ]);
  setState({ usersOverviewOwn, usersOverviewOwner });
}

export function closeUsers() {
  setState({ view: "dashboard" });
}

// "Egyéb" doboz adatai (ismétlődő teendők sablonjai + legutóbbi naplózásaik) —
// az aktív babához tartoznak, ezért babaváltáskor is újra kell tölteni.
export async function refreshCareData(babyId) {
  const careTemplates = await ensureDefaultCareTemplates(babyId);
  const careLogs = await getRecentCareLogs(babyId);
  setState({ careTemplates, careLogs });
}

export async function switchActiveBaby(babyId) {
  setState({ activeBabyId: babyId, babyPickerOpen: false, view: "dashboard", historyEditing: null });
  await Promise.all([refreshCareData(babyId), refreshQuestions(babyId), refreshBabyInfo(babyId)]);
}

// Gyerek-doboz adatai (5. pont): baba alapadatok + legutóbbi súlymérés +
// az előző hét utolsó mérése (a heti gyarapodás "hétfőtől hétfőig" számításának
// kiindulási súlya — nem az aktuális hét első mérése).
function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // hétfő=0
  x.setDate(x.getDate() - day);
  return x;
}

export async function refreshBabyInfo(babyId) {
  const weekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const [baby, latestWeight, weekBaselineWeight] = await Promise.all([
    getBaby(babyId),
    getLatestWeightMeasurement(babyId),
    getLastWeightMeasurementInRange(babyId, lastWeekStart.toISOString(), weekStart.toISOString()),
  ]);
  setState({ babyInfo: { baby, latestWeight, weekBaselineWeight, weekStart } });
}

// "Kérdések" doboz adatai — babaváltáskor újra kell tölteni.
export async function refreshQuestions(babyId) {
  const questions = await getQuestions(babyId);
  setState({ questions });
}

// Historikus adatok oldal megnyitása/bezárása — a lista csak megnyitáskor
// töltődik be, hogy a dashboardon ne kelljen mindig lekérdezni.
export async function openHistory(babyId) {
  setState({ view: "history", historyEditing: null });
  const historyEntries = await getHistoryEntries(babyId);
  setState({ historyEntries });
}

export function closeHistory() {
  setState({ view: "dashboard", historyEditing: null });
}

// Grafikonok oldal megnyitása/bezárása — az összes idősort egyszer töltjük
// be megnyitáskor; a nap/hét/hónap váltás és a léptetés ebből a kliens
// oldali adatból dolgozik, nincs újabb lekérdezés.
export async function openGraphs(babyId) {
  setState({ view: "graphs", graphsData: null });
  const [weightSeries, feedingTimes, diaperEvents, growth] = await Promise.all([
    getWeightSeries(babyId),
    getFeedingTimes(babyId),
    getDiaperEvents(babyId),
    getBabyGrowthInfo(babyId),
  ]);
  setState({ graphsData: { weightSeries, feedingTimes, diaperEvents, growth } });
}

export function closeGraphs() {
  setState({ view: "history" });
}

// Karbantartás oldal megnyitása/bezárása — a baba friss alapadatait
// megnyitáskor töltjük be; a sablonok (state.careTemplates) már be vannak
// töltve a dashboard-adatokkal együtt, azokat nem kell újra lekérni.
export async function openMaintenance(babyId) {
  setState({ view: "maintenance", maintenanceBaby: null });
  const baby = await getBaby(babyId);
  setState({ maintenanceBaby: baby });
}

export function closeMaintenance() {
  setState({ view: "dashboard", maintenanceBaby: null });
}

// Súgó oldal megnyitása/bezárása — tisztán statikus tartalom, nincs hozzá
// adatlekérdezés.
export function openHelp() {
  setState({ view: "help" });
}

export function closeHelp() {
  setState({ view: "dashboard" });
}

// "Másik baba hozzáadása" oldal megnyitása/bezárása — a felhasználónak
// már van legalább egy jóváhagyott baba-tagsága, ez csak egy továbbit ad
// hozzá, ezért soha nem érinti a globális st.status-t.
export function openAddBaby() {
  setState({ view: "add-baby", babyPickerOpen: false });
}

export function closeAddBaby() {
  setState({ view: "dashboard" });
}

// A joinOrCreateBaby() eredményét dolgozza fel, amikor a userNEK MÁR VAN
// legalább egy jóváhagyott babája (tehát ez nem az első regisztráció) —
// ezért itt sosem állítjuk a globális st.status-t "pending"-re, csak a
// memberships/pendingMemberships listákat frissítjük.
export async function handleAddBabyResult(result) {
  const st = getState();
  const userId = st.session.user.id;
  const allMemberships = await getMyMemberships(userId);
  setState({
    memberships: allMemberships.filter((m) => m.status === "approved"),
    pendingMemberships: allMemberships.filter((m) => m.status === "pending"),
  });

  if (result.status === "approved") {
    // Új baba, azonnal admin — váltsunk is át rá.
    await switchActiveBaby(result.baby.id);
  } else {
    // Csatlakozási kérelem egy meglévő babához — maradunk a jelenlegi
    // aktív babán, csak visszajelzünk, hogy a kérelem elment.
    setState({
      view: "dashboard",
      infoModal: {
        title: "Kérelem elküldve",
        message: "A kérelmed elküldve, egy admin-nak jóvá kell hagynia.",
      },
    });
  }
}

export async function exitSession() {
  await supabase.auth.signOut();
  setState({
    status: "auth",
    authMode: "login",
    session: null,
    authError: null,
    memberships: [],
    pendingMemberships: [],
    activeBabyId: null,
    pendingRequests: [],
    babyPickerOpen: false,
    isOwner: false,
    usersOverviewOwn: null,
    usersOverviewOwner: null,
    usersOverviewTab: "own",
  });
}
