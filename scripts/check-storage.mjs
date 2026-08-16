// Diagnostic: verifies the Supabase Storage bucket the app expects actually
// exists. Run with:  node scripts/check-storage.mjs
// Reads .env.local itself (a standalone node script does NOT get Next's env).
// Prints bucket NAMES and presence booleans only — never the service key.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const out = {};
  let raw;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    console.error("Could not read .env.local next to the project root.");
    process.exit(2);
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const target = env.SUPABASE_STORAGE_BUCKET || "meeting-attachments";

console.log("NEXT_PUBLIC_SUPABASE_URL set:      ", Boolean(url), url ? `(${url})` : "");
console.log("SUPABASE_SERVICE_ROLE_KEY set:     ", Boolean(key));
console.log("SUPABASE_STORAGE_BUCKET (resolved):", JSON.stringify(target), env.SUPABASE_STORAGE_BUCKET ? "" : "(defaulted)");

if (!url || !key) {
  console.error("\nMissing URL or service-role key — fix .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.storage.listBuckets();
if (error) {
  console.error("\nlistBuckets() failed:", error.message);
  console.error("If this is an auth error, the service-role key likely doesn't match this project's URL.");
  process.exit(1);
}

const names = data.map((b) => `${b.name}${b.public ? " (public)" : " (private)"}`);
console.log("\nBuckets that actually exist in this project:");
console.log(names.length ? names.map((n) => "  - " + n).join("\n") : "  (none)");

const exists = data.some((b) => b.name === target);
console.log(`\nTarget bucket "${target}" exists: ${exists ? "YES ✅" : "NO ❌"}`);
if (!exists) {
  console.log(`\nFix: create a bucket named EXACTLY "${target}" (Private) in Supabase → Storage,`);
  console.log(`     OR set SUPABASE_STORAGE_BUCKET in .env.local to one of the names above,`);
  console.log(`     then RESTART the dev server (Next reads env only at startup).`);
}
