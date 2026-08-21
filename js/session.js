// Session-átmenetek: eldönti, hogy egy (friss vagy visszatérő) bejelentkezés
// után melyik képernyőt kell mutatni, és betölti hozzá a szükséges adatokat.
import { supabase } from "./supabase-client.js";
import { setState } from "./state.js";
import { resolveUserStatus, loadPendingRequests } from "./auth.js";
import {
  ensureDefaultCareTemplates, getRecentCareLogs, getQuestions, getBaby,
  getLatestWeightMeasurement, getLastWeightMeasurementInRange,
} from "./data.js";
import { getHistoryEntries } from "./history.js";
import { getWeightSeries, getFeedingTimes, getDiaperEvents, getBabyGrowthInfo } from "./charts.js";

export async function enterSession(session) {
  setState({ session });

  const result = await resolveUserStatus(session.user.id);

  if (result.status === "dashboard") {
    const memberships = result.memberships;
    const isOwnerOrAdmin = memberships.some((m) => m.role === "owner" || m.role === "admin");
    const pendingRequests = isOwnerOrAdmin ? await loadPendingRequests(session.user.id) : [];
    const activeBabyId = memberships[0].baby.id;
    setState({
      status: "dashboard",
      memberships,
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

  setState({ status: "needs-baby" });
}

export async function refreshPendingRequests() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return;
  const pendingRequests = await loadPendingRequests(session.user.id);
  setState({ pendingRequests });
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

export async function exitSession() {
  await supabase.auth.signOut();
  setState({
    status: "auth",
    authMode: "login",
    session: null,
    authError: null,
    memberships: [],
    activeBabyId: null,
    pendingRequests: [],
    babyPickerOpen: false,
  });
}
