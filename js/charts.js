// Grafikonok oldal — adatlekérdezések. A tényleges bontás (nap/hét/hónap) és
// a rajzolás a graphs-page.js-ben történik, kliens oldalon, ezekből a nyers
// idősorokból — így egy megnyitáskor egyszer lekérünk mindent, és a
// hét/hónap váltás vagy a léptetés nem indít újabb hálózati kérést.

import { supabase } from "./supabase-client.js";

export async function getWeightSeries(babyId) {
  const { data, error } = await supabase
    .from("weight_measurements")
    .select("measured_at, weight_g")
    .eq("baby_id", babyId)
    .order("measured_at", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return data.map((r) => ({ when: new Date(r.measured_at), weightG: r.weight_g }));
}

export async function getFeedingTimes(babyId) {
  const { data, error } = await supabase
    .from("feedings")
    .select("started_at")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: true })
    .limit(3000);
  if (error) throw error;
  return data.map((r) => new Date(r.started_at));
}

export async function getDiaperEvents(babyId) {
  const { data, error } = await supabase
    .from("diapers")
    .select("changed_at, type")
    .eq("baby_id", babyId)
    .order("changed_at", { ascending: true })
    .limit(3000);
  if (error) throw error;
  return data.map((r) => ({ when: new Date(r.changed_at), type: r.type }));
}

export async function getBabyGrowthInfo(babyId) {
  const { data, error } = await supabase
    .from("babies")
    .select("born_at, birth_weight_g, weekly_gain_target_g")
    .eq("id", babyId)
    .single();
  if (error) throw error;
  return data;
}
