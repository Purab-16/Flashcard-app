import { z } from "zod";
import { withFallback } from "./index";
import { looksLikeDetail, wordCount } from "./detail";
import { parseJsonReply } from "./json";
import type { AIUsage } from "./provider";

export type QuestionType = "mcq" | "short" | "long";
export type Difficulty = "easy" | "medium" | "hard";

export const QUESTIONS_PER_CHUNK = 3;

const MCQ_KEYS = ["A", "B", "C", "D"] as const;
const MAX_SCORE: Record<QuestionType, number> = { mcq: 1, short: 3, long: 6 };

const rawQuestion = z.object({
  prompt: z.string().min(5),
  options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
  correct_answer: z.string().min(1),
  explanation: z.string().min(1),
  source_quote: z.string().min(5),
  hint: z.string().optional(),
  topic: z.string().optional(),
  rubric: z.array(z.object({ point: z.string(), marks: z.number() })).optional(),
});

const rawReply = z.object({ questions: z.array(rawQuestion) });

export type GeneratedQuestion = {
  type: QuestionType;
  difficulty: Difficulty;
  topic: string | null;
  prompt: string;
  options: { key: string; text: string }[] | null;
  correctAnswer: string;
  explanation: string;
  sourceQuote: string;
  hint: string | null;
  rubric: { point: string; marks: number }[] | null;
  maxScore: number;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const SYSTEM = [
  "You write study questions strictly from the text the user gives you.",
  "Never use outside knowledge. Every question must be answerable from the text.",
  "For every question, copy one exact sentence from the text into source_quote.",
  "Only test real subject knowledge: concepts, definitions, reasons, processes, formulas, examples, cause and effect.",
  "Never ask about document details: subject or course name, subject or course code, title, author, teacher, university, date, page number, chapter number, syllabus lists, credits, marks, table of contents, headers, footers, or references.",
  "If the text has no real subject knowledge worth testing, return {\"questions\": []}. Fewer good questions are better than weak ones.",
  "Reply with JSON only. No markdown, no commentary.",
].join(" ");

function buildPrompt(chunk: string, type: QuestionType, difficulty: Difficulty, count: number) {
  const shape: Record<QuestionType, string> = {
    mcq: `Each item: {"prompt", "options": [exactly 4 items {"key":"A".."D","text"}], "correct_answer": "A|B|C|D", "explanation", "source_quote", "hint", "topic"}. Only one option is correct.`,
    short: `Each item: {"prompt", "correct_answer": "model answer in 1 to 3 sentences", "explanation", "source_quote", "hint", "topic", "rubric": [{"point","marks"}]}. Rubric marks add up to ${MAX_SCORE.short}.`,
    long: `Each item: {"prompt", "correct_answer": "model answer in one paragraph", "explanation", "source_quote", "hint", "topic", "rubric": [{"point","marks"}]}. Rubric marks add up to ${MAX_SCORE.long}.`,
  };

  return [
    `Write ${count} ${difficulty} ${type} questions from the text below.`,
    shape[type],
    `Return {"questions": [ ... ]}.`,
    "",
    "TEXT:",
    chunk,
  ].join("\n");
}

function finalize(
  raw: z.infer<typeof rawQuestion>,
  type: QuestionType,
  difficulty: Difficulty,
  chunk: string,
): GeneratedQuestion | null {
  // Drop questions whose source quote is not really in the chunk.
  if (!norm(chunk).includes(norm(raw.source_quote))) return null;
  // Drop questions about document details, or backed by a quote with no real content.
  if (looksLikeDetail(raw.prompt) || wordCount(raw.source_quote) < 6) return null;

  const base = {
    type,
    difficulty,
    topic: raw.topic ?? null,
    prompt: raw.prompt,
    explanation: raw.explanation,
    sourceQuote: raw.source_quote,
    hint: raw.hint ?? null,
    maxScore: MAX_SCORE[type],
  };

  if (type === "mcq") {
    const options = raw.options ?? [];
    const keys = options.map((o) => o.key.toUpperCase());
    const answer = raw.correct_answer.trim().toUpperCase();
    const valid =
      options.length === 4 &&
      MCQ_KEYS.every((k, i) => keys[i] === k) &&
      MCQ_KEYS.includes(answer as (typeof MCQ_KEYS)[number]);
    if (!valid) return null;
    return {
      ...base,
      options: options.map((o, i) => ({ key: MCQ_KEYS[i], text: o.text })),
      correctAnswer: answer,
      rubric: null,
    };
  }

  const rubric = raw.rubric ?? [];
  if (rubric.length === 0) return null;
  return { ...base, options: null, correctAnswer: raw.correct_answer, rubric };
}

export async function generateQuestions(
  chunk: string,
  type: QuestionType,
  difficulty: Difficulty,
  count = QUESTIONS_PER_CHUNK,
): Promise<{ questions: GeneratedQuestion[]; usage: AIUsage }> {
  const { parsed, usage } = await withFallback(async (provider) => {
    const result = await provider.generate(buildPrompt(chunk, type, difficulty, count), SYSTEM);
    return { parsed: parseJsonReply(result.text, rawReply), usage: result.usage };
  });

  const questions = parsed.questions
    .map((q) => finalize(q, type, difficulty, chunk))
    .filter((q): q is GeneratedQuestion => q !== null)
    .slice(0, count);

  return { questions, usage };
}
