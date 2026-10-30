// RLS smoke test. Run: node --env-file=.env scripts/rls-smoke.mjs
// Creates two throwaway users and one subject row. Uses the anon key only.
// No delete is attempted (hard delete is not allowed for agents).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Supabase URL and key must be set in .env");
  process.exit(1);
}

const stamp = Date.now();
const password = `Rls-${stamp}-test`;

async function signUp(label) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `rls.${label}.${stamp}@example.com`,
    password,
  });
  if (error || !data.session) {
    throw new Error(`signup ${label} failed: ${error?.message ?? "no session (is Confirm email OFF?)"}`);
  }
  return { client, id: data.user.id };
}

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

const a = await signUp("a");
const b = await signUp("b");

const insA = await a.client
  .from("subjects")
  .insert({ user_id: a.id, name: `rls-test-${stamp}` })
  .select()
  .single();
check("A can insert own row", !insA.error, insA.error?.message);

const readA = await a.client.from("subjects").select("id");
check("A can read own row", (readA.data?.length ?? 0) === 1);

const readB = await b.client.from("subjects").select("id");
check("B cannot see A's row", !readB.error && readB.data.length === 0);

const insFake = await b.client
  .from("subjects")
  .insert({ user_id: a.id, name: "spoof" });
check("B cannot insert a row as A", !!insFake.error);

const updB = await b.client
  .from("subjects")
  .update({ name: "hacked" })
  .eq("id", insA.data?.id)
  .select();
check("B cannot update A's row", !updB.error && updB.data.length === 0);

const usageB = await b.client.from("usage_log").select("id");
check("B sees no usage_log rows", !usageB.error && usageB.data.length === 0);

for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `  (${r.detail})`}`);
}
console.log(`\nTest users: rls.a.${stamp}@example.com, rls.b.${stamp}@example.com`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
