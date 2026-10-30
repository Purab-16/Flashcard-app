import type { SupabaseClient } from "@supabase/supabase-js";
import { nextReview, START_STATE } from "./index";

/** Update `review_state` for a question after an answer. Never throws: a failure must not lose the answer. */
export async function scheduleQuestionReview(
  supabase: SupabaseClient,
  userId: string,
  questionId: string,
  quality: number,
) {
  const { data: prev } = await supabase
    .from("review_state")
    .select("ease, interval_days, repetitions")
    .eq("question_id", questionId)
    .is("deleted_at", null)
    .maybeSingle();
  const next = nextReview(
    prev
      ? { ease: Number(prev.ease), intervalDays: prev.interval_days, repetitions: prev.repetitions }
      : START_STATE,
    quality,
  );
  const { error } = await supabase.from("review_state").upsert(
    {
      user_id: userId,
      question_id: questionId,
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_at: next.dueAt.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,question_id" },
  );
  if (error) console.error("review_state update failed:", error.message);
}
