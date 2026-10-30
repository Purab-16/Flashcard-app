import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAnswer } from "@/lib/ai/check";
import { logUsage } from "@/lib/ai/usage";
import { LIMIT_MESSAGE, usageToday } from "@/lib/limits";
import { qualityOf } from "@/lib/srs";
import { scheduleQuestionReview } from "@/lib/srs/schedule";
import { createClient } from "@/lib/supabase/server";

const body = z.object({
  questionId: z.uuid(),
  answer: z.string().max(8000),
  timeTakenMs: z.number().int().nonnegative().optional(),
});

// An AI call can take up to 20 seconds, and the fallback provider may run after it.
export const maxDuration = 60;

// Grades one answer of a finished mock test. A blank answer is saved as skipped with no AI call.
export async function POST(request: Request, { params: p }: { params: Promise<{ id: string }> }) {
  const { id } = await p;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  const { questionId, answer, timeTakenMs } = parsed.data;

  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, finished_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  if (session.finished_at) return NextResponse.json({ error: "This test is already finished" }, { status: 409 });

  // Grading the same question twice must not create two attempts (for example after a retry).
  const { data: already } = await supabase
    .from("attempts")
    .select("id")
    .eq("session_id", id)
    .eq("question_id", questionId)
    .maybeSingle();
  if (already) return NextResponse.json({ ok: true, duplicate: true });

  const { data: q, error: qError } = await supabase
    .from("questions")
    .select("id, type, prompt, options, correct_answer, explanation, source_quote, rubric, max_score, topic")
    .eq("id", questionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const blank = !answer.trim();
  if (blank) {
    const { error } = await supabase.from("attempts").insert({
      user_id: user.id,
      question_id: q.id,
      session_id: id,
      is_correct: false,
      score: 0,
      max_score: Number(q.max_score),
      feedback: { skipped: true },
      time_taken_ms: timeTakenMs ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (q.type !== "mcq" && (await usageToday(supabase, user.id)).remaining <= 0) {
    return NextResponse.json({ error: LIMIT_MESSAGE, limitReached: true }, { status: 429 });
  }

  let result;
  try {
    result = await checkAnswer({
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      sourceQuote: q.source_quote,
      rubric: q.rubric,
      maxScore: Number(q.max_score),
      topic: q.topic,
      answer,
    });
  } catch (e) {
    console.error("mock checkAnswer failed:", e);
    return NextResponse.json({ error: "The AI is busy or gave a bad reply. Try again." }, { status: 502 });
  }
  if (result.usage) await logUsage(supabase, user.id, result.usage);

  const { error: insertError } = await supabase.from("attempts").insert({
    user_id: user.id,
    question_id: q.id,
    session_id: id,
    answer_text: q.type === "mcq" ? null : answer,
    selected_option: q.type === "mcq" ? answer : null,
    is_correct: result.isCorrect,
    score: result.score,
    max_score: result.maxScore,
    feedback: {
      reasoning: result.reasoning,
      missedPoints: result.missedPoints,
      rubric: result.rubric,
      weakTopic: result.weakTopic,
    },
    time_taken_ms: timeTakenMs ?? null,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await scheduleQuestionReview(supabase, user.id, q.id, qualityOf(result.score, result.maxScore, false));
  return NextResponse.json({ ok: true });
}
