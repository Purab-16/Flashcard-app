import { z } from "zod";
import { withFallback } from "./index";
import { parseJsonReply } from "./json";
import type { AIUsage } from "./provider";
import type { QuestionType } from "./questions";

export type CheckInput = {
  type: QuestionType;
  prompt: string;
  options: { key: string; text: string }[] | null;
  correctAnswer: string;
  explanation: string;
  sourceQuote: string;
  rubric: { point: string; marks: number }[] | null;
  maxScore: number;
  topic: string | null;
  answer: string;
};

export type CheckResult = {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  correctAnswer: string;
  reasoning: string;
  missedPoints: string[];
  /** Marks per rubric point for short and long answers. Empty for MCQ. */
  rubric: { point: string; marks: number; awarded: number }[];
  weakTopic: string | null;
  usage: AIUsage | null;
};

const aiReply = z.object({
  score: z.number(),
  reasoning: z.string(),
  missed_points: z.array(z.string()).default([]),
  weak_topic: z.string().nullable().optional(),
  rubric_scores: z.array(z.object({ point: z.string().optional(), awarded: z.number() })).default([]),
});

const SYSTEM = [
  "You are a fair examiner. Mark the student's answer against the model answer and rubric only.",
  "Give partial marks for partly correct answers. Never exceed the max score.",
  "Reply with JSON only. No markdown, no commentary.",
].join(" ");

/** MCQ is marked locally with no AI call. Short and long answers use one AI call. */
export async function checkAnswer(input: CheckInput): Promise<CheckResult> {
  if (input.type === "mcq") {
    const isCorrect = input.answer.trim().toUpperCase() === input.correctAnswer.trim().toUpperCase();
    return {
      isCorrect,
      score: isCorrect ? input.maxScore : 0,
      maxScore: input.maxScore,
      correctAnswer: input.correctAnswer,
      reasoning: input.explanation,
      missedPoints: [],
      rubric: [],
      weakTopic: isCorrect ? null : input.topic,
      usage: null,
    };
  }

  const prompt = [
    `Question: ${input.prompt}`,
    `Model answer: ${input.correctAnswer}`,
    `Rubric: ${JSON.stringify(input.rubric ?? [])}`,
    `Max score: ${input.maxScore}`,
    `Student answer: ${input.answer || "(blank)"}`,
    "",
    `Return {"score": number from 0 to ${input.maxScore}, "reasoning": "short explanation", "missed_points": ["..."], "weak_topic": "short topic name or null", "rubric_scores": [{"point": "rubric point text", "awarded": number}]}.`,
    "rubric_scores has one entry per rubric point, in the same order. awarded is between 0 and the marks of that point.",
  ].join("\n");

  const { parsed, usage } = await withFallback(async (provider) => {
    const result = await provider.check(prompt, SYSTEM);
    return { parsed: parseJsonReply(result.text, aiReply), usage: result.usage };
  });

  // Per-point marks. If the AI gave one entry per rubric point, the total is their sum so the numbers always agree.
  const rubricIn = input.rubric ?? [];
  const rubric =
    rubricIn.length > 0 && parsed.rubric_scores.length === rubricIn.length
      ? rubricIn.map((r, i) => ({
          point: r.point,
          marks: r.marks,
          awarded: Math.min(Math.max(parsed.rubric_scores[i].awarded, 0), r.marks),
        }))
      : [];
  const summed = rubric.reduce((t, r) => t + r.awarded, 0);
  const score = Math.min(Math.max(rubric.length ? summed : parsed.score, 0), input.maxScore);
  const isCorrect = score >= input.maxScore * 0.7;

  return {
    isCorrect,
    score,
    maxScore: input.maxScore,
    correctAnswer: input.correctAnswer,
    reasoning: parsed.reasoning,
    missedPoints: parsed.missed_points,
    rubric,
    weakTopic: isCorrect ? null : (parsed.weak_topic ?? input.topic),
    usage,
  };
}
