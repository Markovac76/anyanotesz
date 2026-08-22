// Build-időben (Vercel deploy) legenerálja a config.js-t egy környezeti
// változóból — a Lapról Lapra projekt mintáját követve. A config.js maga
// nincs git-ben (lásd .gitignore); ez a szkript hozza létre minden build
// alkalmával, hogy a böngésző natív ES-modul importja (js/supabase-client.js
// -> "../config.js") megtalálja induláskor.

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Hiányzik a SUPABASE_URL és/vagy a SUPABASE_ANON_KEY környezeti változó. " +
    "Állítsd be mindkettőt a Vercel projekt Settings → Environment Variables " +
    "alatt, majd deployolj újra."
  );
  process.exit(1);
}

const content =
  `export const SUPABASE_URL = "${SUPABASE_URL}";\n` +
  `export const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";\n`;

const outPath = path.join(__dirname, "..", "config.js");
fs.writeFileSync(outPath, content);
console.log(`config.js legenerálva (${outPath}).`);
