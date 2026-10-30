import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIUsage } from "./provider";

export async function logUsage(
  supabase: SupabaseClient,
  userId: string,
  usage: AIUsage,
) {
  const { error } = await supabase.from("usage_log").insert({
    user_id: userId,
    provider: usage.provider,
    model: usage.model,
    kind: usage.kind,
    tokens_in: usage.tokensIn,
    tokens_out: usage.tokensOut,
  });
  if (error) throw error;
}
