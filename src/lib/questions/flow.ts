import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isLowValueChunk } from "@/lib/ai/detail";
import { generateQuestions } from "@/lib/ai/questions";
import { logUsage } from "@/lib/ai/usage";
import { LIMIT_MESSAGE, usageToday } from "@/lib/limits";

export const flowParams = z.object({
  type: z.enum(["mcq", "short", "long"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

// POST also takes chunks the AI already found empty in this session, so they are not tried again.
export const flowPostBody = flowParams.extend({ skip: z.array(z.uuid()).max(500).optional() });

export type FlowParams = z.infer<typeof flowParams>;
export type FlowResult = { status: number; body: Record<string, unknown> };

// Fields the browser may see before the user has answered. No answer, no explanation.
const SAFE_FIELDS = "id, type, difficulty, topic, prompt, options, hint, max_score";

/** Questions of this type and difficulty, across the given documents, that the user has not answered yet. */
export async function listUnanswered(
  supabase: SupabaseClient,
  documentIds: string[],
  { type, difficulty }: FlowParams,
): Promise<FlowResult> {
  if (!documentIds.length) return { status: 200, body: { questions: [] } };

  const { data: questions, error } = await supabase
    .from("questions")
    .select(SAFE_FIELDS)
    .in("document_id", documentIds)
    .eq("type", type)
    .eq("difficulty", difficulty)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return { status: 500, body: { error: error.message } };
  if (!questions.length) return { status: 200, body: { questions: [] } };

  const { data: attempts, error: attemptError } = await supabase
    .from("attempts")
    .select("question_id")
    .in("question_id", questions.map((q) => q.id));
  if (attemptError) return { status: 500, body: { error: attemptError.message } };

  const answered = new Set(attempts.map((a) => a.question_id));
  return { status: 200, body: { questions: questions.filter((q) => !answered.has(q.id)) } };
}

/** Generates questions for the next chunk that has none yet, across the given documents. One chunk, one AI call. */
export async function generateNext(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
  { type, difficulty }: FlowParams,
  skip: Set<string>,
): Promise<FlowResult> {
  if (!documentIds.length) return { status: 404, body: { error: "No documents with text yet" } };

  // Documents in the given order, chunks in reading order inside each document.
  const { data: chunkRows, error: chunkError } = await supabase
    .from("chunks")
    .select("id, document_id, topic, content, idx")
    .in("document_id", documentIds)
    .is("deleted_at", null)
    .order("idx", { ascending: true });
  if (chunkError) return { status: 500, body: { error: chunkError.message } };
  const docOrder = new Map(documentIds.map((d, i) => [d, i]));
  const chunks = [...(chunkRows ?? [])].sort(
    (a, b) => (docOrder.get(a.document_id) ?? 0) - (docOrder.get(b.document_id) ?? 0) || a.idx - b.idx,
  );
  if (!chunks.length) return { status: 404, body: { error: "This document has no text yet" } };

  const { data: existing, error: existingError } = await supabase
    .from("questions")
    .select("chunk_id")
    .in("document_id", documentIds)
    .eq("type", type)
    .eq("difficulty", difficulty)
    .is("deleted_at", null);
  if (existingError) return { status: 500, body: { error: existingError.message } };

  const covered = new Set(existing.map((q) => q.chunk_id));
  const remaining = chunks.filter((c) => !covered.has(c.id));
  if (!remaining.length) return { status: 200, body: { questions: [], done: true } };

  // Skip chunks with no real content (title pages, code lists) without an AI call.
  // If the AI finds nothing worth asking in a chunk, move on to the next one (max 2 AI calls per request).
  const candidates = remaining.filter((c) => !skip.has(c.id) && !isLowValueChunk(c.content));
  const skipped: string[] = [];
  const usage = await usageToday(supabase, userId);
  let chunk: (typeof remaining)[number] | null = null;
  let generated: Awaited<ReturnType<typeof generateQuestions>> | null = null;
  let aiCalls = 0;
  for (const candidate of candidates) {
    if (aiCalls >= 2) break;
    if (usage.remaining - aiCalls <= 0) {
      return { status: 429, body: { error: LIMIT_MESSAGE, limitReached: true } };
    }
    aiCalls++;
    try {
      generated = await generateQuestions(candidate.content, type, difficulty);
    } catch (e) {
      console.error("generateQuestions failed:", e);
      return { status: 502, body: { error: "The AI is busy or gave a bad reply. Try again in a moment." } };
    }
    await logUsage(supabase, userId, generated.usage);
    if (generated.questions.length) {
      chunk = candidate;
      break;
    }
    skipped.push(candidate.id);
  }

  if (!chunk || !generated || !generated.questions.length) {
    // Every candidate was checked and none is worth asking about: nothing more to do here.
    if (candidates.length <= aiCalls) return { status: 200, body: { questions: [], done: true, skipped } };
    // More chunks are left. The client asks again and sends back what was skipped.
    return { status: 200, body: { questions: [], done: false, retry: true, skipped } };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("questions")
    .insert(
      generated.questions.map((q) => ({
        user_id: userId,
        document_id: chunk.document_id,
        chunk_id: chunk.id,
        type: q.type,
        difficulty: q.difficulty,
        topic: q.topic ?? chunk.topic,
        prompt: q.prompt,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        source_quote: q.sourceQuote,
        rubric: q.rubric,
        max_score: q.maxScore,
        hint: q.hint,
      })),
    )
    .select(SAFE_FIELDS);
  if (insertError) return { status: 500, body: { error: insertError.message } };

  const pickedIndex = candidates.indexOf(chunk);
  return {
    status: 200,
    body: { questions: inserted, done: pickedIndex === candidates.length - 1, skipped },
  };
}
