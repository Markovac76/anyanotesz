// Grafikonok oldal — adatlekérdezések. A tényleges bontás (nap/hét/hónap) és
// a rajzolás a graphs-page.js-ben történik, kliens oldalon, ezekből a nyers
// idősorokból — így egy megnyitáskor egyszer lekérünk mindent, és a
// hét/hónap váltás vagy a léptetés nem indít újabb hálózati kérést.

import { supabase } from "./supabase-client.js";

// A limit a rendezés UTÁN érvényesül — ascending sorrendben egy limit a
// legrégebbi N sort tartaná meg, a legújabbak esnének ki a grafikonból,
// ha a történet túlnő a limiten. Ezért csökkenő sorrendben (legújabb
// előbb) kérdezünk le + limitálunk, majd .reverse()-eljük vissza
// időrendbe (régi → új), amit a rajzoló kód vár.
export async function getWeightSeries(babyId) {
  const { data, error } = await supabase
    .from("weight_measurements")
    .select("measured_at, weight_g")
    .eq("baby_id", babyId)
    .order("measured_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data.reverse().map((r) => ({ when: new Date(r.measured_at), weightG: r.weight_g }));
}

export async function getFeedingTimes(babyId) {
  const { data, error } = await supabase
    .from("feedings")
    .select("started_at")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false })
    .limit(3000);
  if (error) throw error;
  return data.reverse().map((r) => new Date(r.started_at));
}

export async function getDiaperEvents(babyId) {
  const { data, error } = await supabase
    .from("diapers")
    .select("changed_at, type")
    .eq("baby_id", babyId)
    .order("changed_at", { ascending: false })
    .limit(3000);
  if (error) throw error;
  return data.reverse().map((r) => ({ when: new Date(r.changed_at), type: r.type }));
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
