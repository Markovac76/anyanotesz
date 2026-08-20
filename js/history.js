// Historikus adatok: a súlymérés/szoptatás/pelenkacsere/care_logs táblák
// egyesítése egy közös, kronologikus listává. A "care_logs" bejegyzések
// ("Egyéb" típusként) a Köldökápolás/D-vitamin/K-vitamin naplózásokból
// származnak, lásd specifikacio.md 6.4. A "Ruhátlan testsúlymérés" saját
// típusként ("weight") jelenik meg — a demó ezt nem ismerte, de a valós
// alkalmazásban szükség van rá, hogy egy elgépelt súlyérték utólag is
// javítható legyen a felületről.

import { supabase } from "./supabase-client.js";

const HISTORY_LIMIT = 150;

export async function getHistoryEntries(babyId) {
  const [weightRes, feedRes, diaperRes, careRes] = await Promise.all([
    supabase
      .from("weight_measurements")
      .select("id, measured_at, weight_g")
      .eq("baby_id", babyId)
      .order("measured_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("feedings")
      .select("id, side, started_at, cant_measure, weight_before_g, weight_after_g, extra_milk_ml, extra_formula_ml")
      .eq("baby_id", babyId)
      .order("started_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("diapers")
      .select("id, type, poop_color, poop_texture, note, changed_at")
      .eq("baby_id", babyId)
      .order("changed_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("care_logs")
      .select("id, done_at, template:care_templates(id, name)")
      .eq("baby_id", babyId)
      .order("done_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (weightRes.error) throw weightRes.error;
  if (feedRes.error) throw feedRes.error;
  if (diaperRes.error) throw diaperRes.error;
  if (careRes.error) throw careRes.error;

  const weightEntries = weightRes.data.map((w) => ({
    id: w.id,
    type: "weight",
    when: new Date(w.measured_at),
    weightG: w.weight_g,
  }));

  const feedEntries = feedRes.data.map((f) => ({
    id: f.id,
    type: "feed",
    when: new Date(f.started_at),
    side: f.side,
    cantMeasure: f.cant_measure,
    wStart: f.weight_before_g != null ? String(f.weight_before_g) : "",
    wEnd: f.weight_after_g != null ? String(f.weight_after_g) : "",
    extraMilk: f.extra_milk_ml != null ? String(f.extra_milk_ml) : "",
    extraFormula: f.extra_formula_ml != null ? String(f.extra_formula_ml) : "",
  }));

  const diaperEntries = diaperRes.data.map((d) => ({
    id: d.id,
    type: "diaper",
    when: new Date(d.changed_at),
    diaperType: d.type,
    poopColor: d.poop_color || "sárga",
    poopTexture: d.poop_texture || "pépes",
    note: d.note || "",
  }));

  const otherEntries = careRes.data.map((c) => ({
    id: c.id,
    type: "other",
    when: new Date(c.done_at),
    templateName: c.template?.name || "Egyéb",
  }));

  return [...weightEntries, ...feedEntries, ...diaperEntries, ...otherEntries].sort((a, b) => b.when - a.when);
}

export async function updateWeightEntry(id, { when, weightG }) {
  const { error } = await supabase
    .from("weight_measurements")
    .update({ measured_at: when.toISOString(), weight_g: weightG })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWeightEntry(id) {
  const { error } = await supabase.from("weight_measurements").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFeedingEntry(id, { when, side, cantMeasure, wStart, wEnd, extraMilk, extraFormula }) {
  const { error } = await supabase
    .from("feedings")
    .update({
      started_at: when.toISOString(),
      side,
      cant_measure: cantMeasure,
      weight_before_g: cantMeasure || !wStart ? null : parseInt(wStart, 10),
      weight_after_g: cantMeasure || !wEnd ? null : parseInt(wEnd, 10),
      extra_milk_ml: extraMilk ? parseInt(extraMilk, 10) : null,
      extra_formula_ml: extraFormula ? parseInt(extraFormula, 10) : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFeedingEntry(id) {
  const { error } = await supabase.from("feedings").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDiaperEntry(id, { when, diaperType, poopColor, poopTexture, note }) {
  const { error } = await supabase
    .from("diapers")
    .update({
      changed_at: when.toISOString(),
      type: diaperType,
      poop_color: diaperType === "pisi" ? null : poopColor,
      poop_texture: diaperType === "pisi" ? null : poopTexture,
      note: note || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDiaperEntry(id) {
  const { error } = await supabase.from("diapers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCareLogEntry(id, { when }) {
  const { error } = await supabase.from("care_logs").update({ done_at: when.toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteCareLogEntry(id) {
  const { error } = await supabase.from("care_logs").delete().eq("id", id);
  if (error) throw error;
}
