// Napi biztonsági mentés — minden babáról egy Excel munkafüzetet generál
// (Testsúlymérés / Szoptatás / Pelenkacsere / Egyéb / Kérdések munkalapok),
// feltölti a privát "baby-backups" Storage bucket-be, és törli a 30 napnál
// régebbi mentéseket. Kizárólag a pg_cron ütemezés hívja (lásd
// supabase/migrations/0009_baby_backups.sql), egy egyszerű megosztott
// titok (BACKUP_CRON_SECRET) ellenőrzésével — nem a Supabase auth-ot
// használja, mert ezt sosem hívja böngésző/bejelentkezett user.
//
// A service role kulccsal létrehozott kliens megkerüli az RLS-t, hogy a
// funkció minden baba minden adatához hozzáférjen (a normál kliens-oldali
// policy-k jóváhagyott tagsághoz kötik a napi adatokat).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BACKUP_CRON_SECRET = Deno.env.get("BACKUP_CRON_SECRET");

const RETENTION_DAYS = 30;

const SIDE_LABEL: Record<string, string> = { left: "Bal", right: "Jobb", both: "Mindkettő" };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCell(key: string, value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Igen" : "Nem";
  if (key.endsWith("_at") && typeof value === "string") return formatDateTime(value);
  if (key === "side" && typeof value === "string") return SIDE_LABEL[value] ?? value;
  return value as string | number;
}

function toSheet(rows: Record<string, unknown>[] | null, labels: Record<string, string>, order: string[]) {
  const mapped = (rows ?? []).map((row) => {
    const out: Record<string, unknown> = {};
    for (const key of order) out[labels[key]] = formatCell(key, row[key]);
    return out;
  });
  return XLSX.utils.json_to_sheet(mapped, { header: order.map((k) => labels[k]) });
}

// deno-lint-ignore no-explicit-any
async function backupOneBaby(supabase: any, babyId: string, dateStr: string) {
  const [weights, feedings, diapers, careLogs, questions] = await Promise.all([
    supabase.from("weight_measurements").select("measured_at, weight_g").eq("baby_id", babyId).order("measured_at"),
    supabase.from("feedings").select("started_at, ended_at, side, cant_measure, weight_before_g, weight_after_g, extra_milk_ml, extra_formula_ml").eq("baby_id", babyId).order("started_at"),
    supabase.from("diapers").select("changed_at, type, poop_color, poop_texture, note").eq("baby_id", babyId).order("changed_at"),
    supabase.from("care_logs").select("done_at, care_templates(name, category)").eq("baby_id", babyId).order("done_at"),
    supabase.from("questions").select("created_at, text, recipient, answer, answered").eq("baby_id", babyId).order("created_at"),
  ]);

  for (const r of [weights, feedings, diapers, careLogs, questions]) {
    if (r.error) throw new Error(r.error.message);
  }

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    toSheet(weights.data, { measured_at: "Dátum/idő", weight_g: "Súly (g)" }, ["measured_at", "weight_g"]),
    "Testsúlymérés",
  );

  XLSX.utils.book_append_sheet(
    wb,
    toSheet(feedings.data, {
      started_at: "Kezdés", ended_at: "Befejezés", side: "Oldal", cant_measure: "Nem mérhető",
      weight_before_g: "Súly elején (g)", weight_after_g: "Súly végén (g)",
      extra_milk_ml: "Anyatej (ml)", extra_formula_ml: "Tápszer (ml)",
    }, ["started_at", "ended_at", "side", "cant_measure", "weight_before_g", "weight_after_g", "extra_milk_ml", "extra_formula_ml"]),
    "Szoptatás",
  );

  XLSX.utils.book_append_sheet(
    wb,
    toSheet(diapers.data, {
      changed_at: "Dátum/idő", type: "Típus", poop_color: "Szín", poop_texture: "Állag", note: "Jegyzet",
    }, ["changed_at", "type", "poop_color", "poop_texture", "note"]),
    "Pelenkacsere",
  );

  // deno-lint-ignore no-explicit-any
  const careRows = (careLogs.data ?? []).map((r: any) => ({
    done_at: r.done_at,
    name: r.care_templates?.name ?? "",
    category: r.care_templates?.category === "medication" ? "Gyógyszer" : "Tevékenység",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(careRows, { done_at: "Dátum/idő", name: "Megnevezés", category: "Kategória" }, ["done_at", "name", "category"]),
    "Egyéb",
  );

  XLSX.utils.book_append_sheet(
    wb,
    toSheet(questions.data, {
      created_at: "Dátum", text: "Kérdés", recipient: "Címzett", answer: "Válasz", answered: "Megválaszolva",
    }, ["created_at", "text", "recipient", "answer", "answered"]),
    "Kérdések",
  );

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const path = `${babyId}/${dateStr}.xlsx`;
  const { error: uploadError } = await supabase.storage.from("baby-backups").upload(path, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);
}

// deno-lint-ignore no-explicit-any
async function cleanupOldBackups(supabase: any, babyId: string) {
  const { data: files, error } = await supabase.storage.from("baby-backups").list(babyId);
  if (error) throw new Error(error.message);

  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  const stale = (files ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((f: any) => {
      const match = f.name.match(/^(\d{4}-\d{2}-\d{2})\.xlsx$/);
      if (!match) return false;
      return new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff;
    })
    // deno-lint-ignore no-explicit-any
    .map((f: any) => `${babyId}/${f.name}`);

  if (stale.length > 0) {
    const { error: removeError } = await supabase.storage.from("baby-backups").remove(stale);
    if (removeError) throw new Error(removeError.message);
  }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!BACKUP_CRON_SECRET || authHeader !== `Bearer ${BACKUP_CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: babies, error: babiesError } = await supabase.from("babies").select("id, nickname");
  if (babiesError) {
    return new Response(JSON.stringify({ error: babiesError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10); // ÉÉÉÉ-HH-NN
  let succeeded = 0;
  const errors: { babyId: string; nickname: string; message: string }[] = [];

  for (const baby of babies ?? []) {
    try {
      await backupOneBaby(supabase, baby.id, today);
      await cleanupOldBackups(supabase, baby.id);
      succeeded++;
    } catch (e) {
      errors.push({ babyId: baby.id, nickname: baby.nickname, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ succeeded, failed: errors.length, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
