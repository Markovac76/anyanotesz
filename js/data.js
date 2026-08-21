import { supabase } from "./supabase-client.js";

// ---- Babák ----

export async function findBabyByNickname(nickname) {
  const { data, error } = await supabase
    .from("babies")
    .select("id, nickname, full_name")
    .ilike("nickname", nickname.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBaby({ nickname, full_name }) {
  const { data, error } = await supabase
    .from("babies")
    .insert({ nickname: nickname.trim(), full_name: full_name?.trim() || null })
    .select("id, nickname, full_name")
    .single();
  if (error) throw error;
  return data;
}

export async function getBaby(babyId) {
  const { data, error } = await supabase
    .from("babies")
    .select("id, nickname, full_name, born_at, birth_place, birth_weight_g, birth_length_cm, weekly_gain_target_g")
    .eq("id", babyId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBaby(babyId, patch) {
  const { data, error } = await supabase
    .from("babies")
    .update(patch)
    .eq("id", babyId)
    .select("id, nickname, full_name, born_at, birth_place, birth_weight_g, birth_length_cm, weekly_gain_target_g")
    .single();
  if (error) throw error;
  return data;
}

// ---- baby_members ----

export async function createMembership({ babyId, userId, role, status }) {
  const { data, error } = await supabase
    .from("baby_members")
    .insert({ baby_id: babyId, user_id: userId, role, status })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMyMemberships(userId) {
  const { data, error } = await supabase
    .from("baby_members")
    .select("role, status, baby:babies(id, nickname, full_name)")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

// ---- Globális owner (profiles.is_owner) ----

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_owner")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Owner globális áttekintője: minden baba, mindegyikhez a tagságai
// (role/status/user_id) — a babies_select_authenticated policy mindenkinek
// nyitott, a baby_members_select policy pedig globális owner-nek is
// engedi a SELECT-et (lásd 0005_owner_model.sql). Az emaileket külön
// lekérdezéssel egészítjük ki a profiles táblából (nincs FK a baby_members
// és a profiles között, amit a PostgREST embedelni tudna) — a profiles
// SELECT policy (lásd 0006_profile_emails.sql) magától szűkíti a
// visszakapott sorokat arra, amit a hívó egyáltalán láthat.
export async function getAllBabiesOverview() {
  const { data, error } = await supabase
    .from("babies")
    .select("id, nickname, full_name, baby_members(user_id, role, status)")
    .order("nickname");
  if (error) throw error;
  const babies = data ?? [];

  const userIds = [...new Set(babies.flatMap((b) => (b.baby_members || []).map((m) => m.user_id)))];
  if (userIds.length === 0) return babies;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", userIds);
  if (profilesError) throw profilesError;
  const emailById = new Map(profiles.map((p) => [p.id, p.email]));

  return babies.map((b) => ({
    ...b,
    baby_members: (b.baby_members || []).map((m) => ({ ...m, email: emailById.get(m.user_id) ?? null })),
  }));
}

export async function promoteToAdmin(babyId, userId) {
  const { error } = await supabase
    .from("baby_members")
    .update({ role: "admin" })
    .eq("baby_id", babyId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function demoteToUser(babyId, userId) {
  const { error } = await supabase
    .from("baby_members")
    .update({ role: "user" })
    .eq("baby_id", babyId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteBaby(babyId) {
  const { error } = await supabase.from("babies").delete().eq("id", babyId);
  if (error) throw error;
}

// Saját tagság törlése (admin lemondása a babáról, vagy sima kilépés).
export async function leaveBaby(babyId, userId) {
  const { error } = await supabase
    .from("baby_members")
    .delete()
    .eq("baby_id", babyId)
    .eq("user_id", userId);
  if (error) throw error;
}

// Csak azokra a babákra szűkítve, amelyeknél a hívó admin — enélkül egy
// globális owner-nél (aki most már RLS-szinten is lát minden pending sort)
// idegen babák kérelmei is bekeverednének a dashboard inline kártyájába.
export async function getPendingRequestsForAdminBabies(babyIds) {
  if (babyIds.length === 0) return [];
  const { data, error } = await supabase
    .from("baby_members")
    .select("baby_id, user_id, role, created_at, baby:babies(id, nickname)")
    .eq("status", "pending")
    .in("baby_id", babyIds);
  if (error) throw error;
  return data ?? [];
}

export async function approveMembership(babyId, userId, approvedByUserId) {
  const { error } = await supabase
    .from("baby_members")
    .update({ status: "approved", approved_by: approvedByUserId, approved_at: new Date().toISOString() })
    .eq("baby_id", babyId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function rejectMembership(babyId, userId) {
  const { error } = await supabase
    .from("baby_members")
    .update({ status: "rejected" })
    .eq("baby_id", babyId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ---- Ruhátlan testsúlymérés ----

export async function createWeightMeasurement({ babyId, userId, measuredAt, weightG }) {
  const { error } = await supabase.from("weight_measurements").insert({
    baby_id: babyId,
    measured_at: measuredAt.toISOString(),
    weight_g: weightG,
    created_by: userId,
  });
  if (error) throw error;
}

// Legutóbbi mérés — ez adja a gyerek-doboz "aktuális súly" értékét.
export async function getLatestWeightMeasurement(babyId) {
  const { data, error } = await supabase
    .from("weight_measurements")
    .select("weight_g, measured_at")
    .eq("baby_id", babyId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Az előző hét utolsó mérése — ez adja a heti gyarapodás számításának
// kiindulási súlyát ("hétfőtől hétfőig" — a most futó hét elejére eső
// súlyt az előző hét záró mérése adja, nem az aktuális hét első mérése).
export async function getLastWeightMeasurementInRange(babyId, sinceIso, beforeIso) {
  const { data, error } = await supabase
    .from("weight_measurements")
    .select("weight_g, measured_at")
    .eq("baby_id", babyId)
    .gte("measured_at", sinceIso)
    .lt("measured_at", beforeIso)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---- Szoptatás ----

export async function createFeeding({
  babyId, userId, side, startedAt, endedAt, cantMeasure,
  weightBeforeG, weightAfterG, extraMilkMl, extraFormulaMl,
}) {
  const { error } = await supabase.from("feedings").insert({
    baby_id: babyId,
    side,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    cant_measure: cantMeasure,
    weight_before_g: cantMeasure ? null : weightBeforeG,
    weight_after_g: cantMeasure ? null : weightAfterG,
    extra_milk_ml: extraMilkMl,
    extra_formula_ml: extraFormulaMl,
    created_by: userId,
  });
  if (error) throw error;
}

// ---- Pelenkacsere ----

export async function createDiaper({ babyId, userId, type, poopColor, poopTexture, note, changedAt }) {
  const { error } = await supabase.from("diapers").insert({
    baby_id: babyId,
    type,
    poop_color: type === "pisi" ? null : poopColor,
    poop_texture: type === "pisi" ? null : poopTexture,
    note: note || null,
    changed_at: changedAt.toISOString(),
    created_by: userId,
  });
  if (error) throw error;
}

// ---- Egyéb: ismétlődő teendők (care_templates / care_logs) ----
// A sablonok a Karbantartás oldalon szabadon szerkeszthetők/törölhetők
// (lásd specifikacio.md 6.6) — új babánál csak akkor töltjük fel ezt a
// kiinduló 3 sablont, ha még egyáltalán nincs egy sablonja sem, hogy egy
// szándékos törlés ne "éledjen újra" a következő dashboard-betöltéskor.

const DEFAULT_CARE_TEMPLATES = [
  { name: "Köldökápolás", frequency: "daily", category: "activity" },
  { name: "D-vitamin csepp", frequency: "daily", category: "medication" },
  { name: "K-vitamin csepp", frequency: "monthly", category: "medication" },
];

export async function getCareTemplates(babyId) {
  const { data, error } = await supabase
    .from("care_templates")
    .select("id, name, frequency, category")
    .eq("baby_id", babyId);
  if (error) throw error;
  return data ?? [];
}

export async function ensureDefaultCareTemplates(babyId) {
  const existing = await getCareTemplates(babyId);
  if (existing.length > 0) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from("care_templates")
    .insert(DEFAULT_CARE_TEMPLATES.map((t) => ({ baby_id: babyId, ...t })))
    .select("id, name, frequency, category");
  if (insertError) throw insertError;
  return inserted;
}

export async function createCareTemplate({ babyId, name, frequency, category }) {
  const { data, error } = await supabase
    .from("care_templates")
    .insert({ baby_id: babyId, name: name.trim(), frequency, category })
    .select("id, name, frequency, category")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCareTemplate(id, patch) {
  const { error } = await supabase.from("care_templates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCareTemplate(id) {
  const { error } = await supabase.from("care_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function getRecentCareLogs(babyId) {
  const { data, error } = await supabase
    .from("care_logs")
    .select("id, template_id, done_at")
    .eq("baby_id", babyId)
    .order("done_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function logCareDone({ templateId, babyId, userId, doneAt }) {
  const { error } = await supabase.from("care_logs").insert({
    template_id: templateId,
    baby_id: babyId,
    done_at: doneAt.toISOString(),
    created_by: userId,
  });
  if (error) throw error;
}

// ---- Kérdések a védőnőnek/orvosnak ----

export async function getQuestions(babyId) {
  const { data, error } = await supabase
    .from("questions")
    .select("id, text, recipient, answer, answered, created_at")
    .eq("baby_id", babyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createQuestion({ babyId, userId, text, recipient }) {
  const { data, error } = await supabase
    .from("questions")
    .insert({ baby_id: babyId, text, recipient, created_by: userId })
    .select("id, text, recipient, answer, answered, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuestion(id, patch) {
  const { error } = await supabase.from("questions").update(patch).eq("id", id);
  if (error) throw error;
}
