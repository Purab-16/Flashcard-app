// Phase 1 RLS check. Run: node --env-file=.env scripts/rls-phase1.mjs
// Creates one throwaway user (anon key only) and checks it sees none of the real data.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Supabase URL and key must be set in .env");
  process.exit(1);
}

const stamp = Date.now();
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.auth.signUp({
  email: `rls.p1.${stamp}@example.com`,
  password: `Rls-${stamp}-test`,
});
if (error || !data.session) {
  console.error("signup failed:", error?.message ?? "no session (is Confirm email OFF?)");
  process.exit(1);
}

let failed = false;
for (const table of ["documents", "chunks", "questions", "attempts", "usage_log"]) {
  const { data: rows, error: e } = await client.from(table).select("id");
  const pass = !e && rows.length === 0;
  if (!pass) failed = true;
  console.log(`${pass ? "PASS" : "FAIL"}  new user sees 0 rows in ${table}${e ? ` (${e.message})` : ""}`);
}

const { data: files, error: fileError } = await client.storage.from("documents").list("");
const filesPass = !fileError && files.length === 0;
if (!filesPass) failed = true;
console.log(`${filesPass ? "PASS" : "FAIL"}  new user sees 0 files in the documents bucket`);

console.log(`\nTest user: rls.p1.${stamp}@example.com`);
process.exit(failed ? 1 : 0);
