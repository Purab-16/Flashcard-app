import type { SupabaseClient } from "@supabase/supabase-js";

// Each AI call writes one row to `usage_log`. The limit counts those rows in the last 24 hours.
const DEFAULT_DAILY_LIMIT = 150;

export const LIMIT_MESSAGE = "You reached today's AI limit. Try again later. MCQ answers still work without AI.";

export const dailyLimit = () => Number(process.env.USAGE_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;

export type Usage = { used: number; limit: number; remaining: number };

export async function usageToday(supabase: SupabaseClient, userId: string): Promise<Usage> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count, error } = await supabase
    .from("usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw error;

  const limit = dailyLimit();
  const used = count ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}
