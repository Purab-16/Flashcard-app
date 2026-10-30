import { createClient } from "@supabase/supabase-js";

// Server only. Uses the service role key, which bypasses RLS. Never import this in a client component.
// Approved use: writing the shared `video_cache` table (see docs/decisions.md).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
