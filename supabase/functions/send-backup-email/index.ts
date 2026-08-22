// A Karbantartás oldal "Legutóbbi mentés emailben kérése" gombja hívja
// (js/data.js requestBackupEmail -> supabase.functions.invoke). A hívó
// user JWT-jét adjuk tovább egy user-scope-os kliensnek, hogy az RLS
// természetes módon érvényesüljön (is_approved_admin ellenőrzés, admin-
// emailek lekérdezése) — csak a Storage-ból való letöltéshez váltunk
// service role-ra, mert azt a policy admin-ra szűkíti, de itt már saját
// magunk ellenőriztük ezt fentebb.

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@^9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_SMTP_USER = Deno.env.get("GMAIL_SMTP_USER")!;
const GMAIL_SMTP_APP_PASSWORD = Deno.env.get("GMAIL_SMTP_APP_PASSWORD")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { babyId } = await req.json();
    if (!babyId) return json({ error: "Hiányzik a babyId." }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nincs bejelentkezve." }, 401);

    // A hívó JWT-jével — az RLS természetes módon érvényesül.
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Nincs bejelentkezve." }, 401);

    const { data: isAdmin, error: adminCheckError } = await supabase.rpc("is_approved_admin", { p_baby_id: babyId });
    if (adminCheckError) return json({ error: adminCheckError.message }, 500);
    if (!isAdmin) return json({ error: "Nincs jogosultságod ehhez a babához." }, 403);

    const { data: babyRow, error: babyError } = await supabase.from("babies").select("nickname").eq("id", babyId).single();
    if (babyError) return json({ error: babyError.message }, 500);

    // A baby_members és a profiles között nincs közvetlen FK (mindkettő az
    // auth.users-re mutat), ezért a PostgREST nem tudja beágyazni — külön
    // lekérdezzük a user_id-kat, majd az emaileket, ugyanaz a minta, mint
    // a js/data.js attachEmails()-ában.
    const { data: memberRows, error: membersError } = await supabase
      .from("baby_members")
      .select("user_id")
      .eq("baby_id", babyId)
      .eq("role", "admin")
      .eq("status", "approved");
    if (membersError) return json({ error: membersError.message }, 500);

    const adminUserIds = (memberRows ?? []).map((m) => m.user_id);
    if (adminUserIds.length === 0) return json({ error: "Nincs admin ennél a babánál." }, 500);

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("email")
      .in("id", adminUserIds);
    if (profilesError) return json({ error: profilesError.message }, 500);

    const emails = (profileRows ?? []).map((p) => p.email).filter((e): e is string => !!e);
    if (emails.length === 0) return json({ error: "Nincs admin email ennél a babánál." }, 500);

    // Service-role kliens a Storage-hoz — a admin-ellenőrzés már megtörtént
    // fentebb, itt egyszerűbb service role-lal olvasni a fájlt.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: files, error: listError } = await admin.storage
      .from("baby-backups")
      .list(babyId, { sortBy: { column: "name", order: "desc" } });
    if (listError) return json({ error: listError.message }, 500);

    const latest = (files ?? []).find((f) => f.name.endsWith(".xlsx"));
    if (!latest) return json({ error: "Még nincs kész biztonsági mentés ehhez a babához." }, 404);

    const { data: fileBlob, error: downloadError } = await admin.storage
      .from("baby-backups")
      .download(`${babyId}/${latest.name}`);
    if (downloadError) return json({ error: downloadError.message }, 500);

    const attachmentBuffer = new Uint8Array(await fileBlob.arrayBuffer());
    const dateLabel = latest.name.replace(/\.xlsx$/, "");

    // Gmail SMTP alkalmazás-jelszóval (nincs saját domain, ezért nem
    // Resend/SES) — az Edge Function futtatókörnyezet kimenő SMTP-port
    // korlátozásai miatt ez érdemben csak élesben, deploy után derül ki
    // biztosan (lásd a lépés végi checklist figyelmeztetését).
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_SMTP_USER, pass: GMAIL_SMTP_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: GMAIL_SMTP_USER,
      to: emails.join(", "),
      subject: `Anyanotesz — ${babyRow.nickname} biztonsági mentése (${dateLabel})`,
      text: `A csatolt Excel fájl "${babyRow.nickname}" legutóbbi (${dateLabel}) automatikus biztonsági mentése.`,
      attachments: [{ filename: latest.name, content: attachmentBuffer }],
    });

    return json({ success: true, sentTo: emails });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
