// Spaced repetition, SM-2 style. Wrong answers come back soon, correct ones later and later.

export type ReviewState = { ease: number; intervalDays: number; repetitions: number };

export const START_STATE: ReviewState = { ease: 2.5, intervalDays: 0, repetitions: 0 };

const MIN_EASE = 1.3;
const RETRY_MINUTES = 10;

/** Turn an attempt into a 0 to 5 quality. 5 = perfect, 4 = right but used a hint, 3 = barely, below 3 = fail. */
export function qualityOf(score: number, maxScore: number, hintUsed: boolean): number {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.99) return hintUsed ? 4 : 5;
  if (ratio >= 0.7) return hintUsed ? 3 : 4;
  if (ratio >= 0.5) return 3;
  if (ratio > 0) return 2;
  return 1;
}

export function nextReview(prev: ReviewState, quality: number, now = new Date()) {
  let { ease, intervalDays, repetitions } = prev;
  let dueAt: Date;

  if (quality < 3) {
    // Failed: start over and ask again in a few minutes.
    repetitions = 0;
    intervalDays = 0;
    dueAt = new Date(now.getTime() + RETRY_MINUTES * 60_000);
  } else {
    intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(intervalDays * ease);
    repetitions += 1;
    dueAt = new Date(now.getTime() + intervalDays * 86_400_000);
  }

  ease = Math.max(MIN_EASE, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return { ease, intervalDays, repetitions, dueAt };
}
