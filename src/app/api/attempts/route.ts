import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAnswer } from "@/lib/ai/check";
import { logUsage } from "@/lib/ai/usage";
import { LIMIT_MESSAGE, usageToday } from "@/lib/limits";
import { locateQuote } from "@/lib/parse/locate";
import { qualityOf } from "@/lib/srs";
import { scheduleQuestionReview } from "@/lib/srs/schedule";
import { createClient } from "@/lib/supabase/server";

const body = z.object({
  questionId: z.uuid(),
  answer: z.string().max(8000),
  hintUsed: z.boolean().default(false),
  timeTakenMs: z.number().int().nonnegative().optional(),
});

// Checks one answer, saves the attempt, and returns the result with the right answer.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  const { questionId, answer, hintUsed, timeTakenMs } = parsed.data;

  const { data: q, error: qError } = await supabase
    .from("questions")
    .select("id, chunk_id, type, prompt, options, correct_answer, explanation, source_quote, rubric, max_score, topic")
    .eq("id", questionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  // MCQ is marked locally with no AI call, so only written answers count against the limit.
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
    console.error("checkAnswer failed:", e);
    return NextResponse.json(
      { error: "The AI is busy or gave a bad reply. Try submitting again." },
      { status: 502 },
    );
  }
  if (result.usage) await logUsage(supabase, user.id, result.usage);

  const { error: insertError } = await supabase.from("attempts").insert({
    user_id: user.id,
    question_id: q.id,
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
    hint_used: hintUsed,
    time_taken_ms: timeTakenMs ?? null,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Schedule the next review. A failure here must not lose the answer the user just gave.
  await scheduleQuestionReview(supabase, user.id, q.id, qualityOf(result.score, result.maxScore, hintUsed));

  const { data: chunk } = await supabase
    .from("chunks")
    .select("content")
    .eq("id", q.chunk_id)
    .maybeSingle();

  return NextResponse.json({
    sourceContext: chunk ? locateQuote(chunk.content, q.source_quote) : null,
    isCorrect: result.isCorrect,
    score: result.score,
    maxScore: result.maxScore,
    correctAnswer: result.correctAnswer,
    reasoning: result.reasoning,
    missedPoints: result.missedPoints,
    rubric: result.rubric,
    sourceQuote: q.source_quote,
    options: q.options,
  });
}
