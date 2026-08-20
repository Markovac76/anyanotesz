// Historikus adatok: a szoptatás/pelenkacsere/care_logs táblák egyesítése egy
// közös, kronologikus listává — a demó mock HISTORY tömbjének valós Supabase
// megfelelője. A "care_logs" bejegyzések ("Egyéb" típusként) a Köldökápolás/
// D-vitamin/K-vitamin naplózásokból származnak, lásd specifikacio.md 6.4.
// A "Ruhátlan testsúlymérés" bejegyzések itt sem jelennek meg — a demó
// TYPE_META-ja is csak feed/diaper/other típust ismer.

import { supabase } from "./supabase-client.js";

const HISTORY_LIMIT = 150;

export async function getHistoryEntries(babyId) {
  const [feedRes, diaperRes, careRes] = await Promise.all([
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
  if (feedRes.error) throw feedRes.error;
  if (diaperRes.error) throw diaperRes.error;
  if (careRes.error) throw careRes.error;

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

  return [...feedEntries, ...diaperEntries, ...otherEntries].sort((a, b) => b.when - a.when);
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
