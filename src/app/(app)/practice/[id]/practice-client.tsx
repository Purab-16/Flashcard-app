"use client";

import { ArrowLeft, ArrowRight, Check, Flag, Lightbulb, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { VideosPanel } from "./videos-panel";

type Question = {
  id: string;
  type: "mcq" | "short" | "long";
  difficulty: string;
  topic: string | null;
  prompt: string;
  options: { key: string; text: string }[] | null;
  hint: string | null;
  max_score: number;
};

type Result = {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  correctAnswer: string;
  reasoning: string;
  missedPoints: string[];
  rubric: { point: string; marks: number; awarded: number }[];
  sourceQuote: string;
  sourceContext: { before: string; match: string; after: string } | null;
  options: { key: string; text: string }[] | null;
};

type Props = {
  documentId: string; // a document id, or a subject id when scope is "subject"
  scope: "document" | "subject" | "review";
  type: "mcq" | "short" | "long";
  difficulty: "easy" | "medium" | "hard";
};

export function PracticeClient({ documentId, scope, type, difficulty }: Props) {
  const [queue, setQueue] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDone, setAllDone] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cardNumber, setCardNumber] = useState(1);
  const [tally, setTally] = useState({ right: 0, missed: 0 });
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const startedAt = useRef(0);
  const started = useRef(false);
  const skipped = useRef<string[]>([]);

  const base =
    scope === "review"
      ? "/api/review/questions"
      : `/api/${scope === "subject" ? "subjects" : "documents"}/${documentId}/questions`;

  // Generate questions for the next chunk. Retries a few times if a chunk gave nothing usable.
  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, difficulty, skip: skipped.current }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not create questions");
        if (body.skipped?.length) skipped.current = [...skipped.current, ...body.skipped];
        if (body.questions.length) {
          setQueue((q) => [...q, ...body.questions]);
          return;
        }
        if (body.done) {
          setAllDone(true);
          return;
        }
      }
      setError("The AI gave no usable questions. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [base, type, difficulty]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch(`${base}?type=${type}&difficulty=${difficulty}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load questions");
        if (body.questions.length) {
          setQueue(body.questions);
          setLoading(false);
        } else {
          await generate();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setLoading(false);
      }
    })();
  }, [base, type, difficulty, generate]);

  const current = queue[0];

  useEffect(() => {
    startedAt.current = Date.now();
  }, [current?.id]);

  async function submit() {
    if (!current || !answer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: current.id,
          answer,
          hintUsed: showHint,
          timeTakenMs: Date.now() - startedAt.current,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not check the answer");
      setResult(body);
      setTally((t) => (body.isCorrect ? { ...t, right: t.right + 1 } : { ...t, missed: t.missed + 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function report() {
    if (!current) return;
    setReporting(true);
    try {
      const res = await fetch(`/api/questions/${current.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not report");
      setReported(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setReporting(false);
    }
  }

  async function next() {
    const rest = queue.slice(1);
    setQueue(rest);
    setCardNumber((n) => n + 1);
    setReported(false);
    setAnswer("");
    setShowHint(false);
    setResult(null);
    setError("");
    if (rest.length === 0 && !allDone) await generate();
  }

  // Keys: 1 to 4 pick an option, Enter checks the answer and then moves on. Typing in a box is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || tag === "SELECT") return;
      if (tag === "INPUT" && (el as HTMLInputElement).type !== "radio") return;
      if (e.metaKey || e.ctrlKey || e.altKey || !current) return;

      if (!result && current.type === "mcq" && /^[1-4]$/.test(e.key)) {
        const option = current.options?.[Number(e.key) - 1];
        if (option) setAnswer(option.key);
        return;
      }
      if (e.key === "Enter") {
        if (result) {
          if (!loading) void next();
        } else if (answer.trim() && !submitting) {
          e.preventDefault();
          void submit();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const optionText = (key: string, options: { key: string; text: string }[] | null) =>
    options?.find((o) => o.key === key)?.text;

  const title = scope === "review" ? "Review" : scope === "subject" ? "Practice subject" : "Practice";
  const typeLabel = { mcq: "MCQ", short: "Short answer", long: "Long answer" }[type];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Documents
          </Link>
          <h1 className="text-3xl font-semibold">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          {tally.right + tally.missed > 0 && (
            <>
              <span className="animate-in fade-in zoom-in-95 rounded-full bg-success-soft px-3 py-1 font-medium text-success">
                {tally.right} right
              </span>
              <span className="animate-in fade-in zoom-in-95 rounded-full bg-danger-soft px-3 py-1 font-medium text-danger">
                {tally.missed} missed
              </span>
            </>
          )}
          {scope !== "review" && (
            <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
              {typeLabel}, {difficulty}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-danger-soft p-4" role="alert">
          <p className="text-sm text-danger">{error}</p>
          {!current && (
            <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
              Try again
            </Button>
          )}
        </div>
      )}

      {loading && !current && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-8" role="status">
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
          <p className="pt-2 text-sm text-muted-foreground">
            Making questions from your notes. This can take up to 30 seconds.
          </p>
        </div>
      )}

      {!loading && !current && allDone && !error && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-8">
          <h2 className="text-xl font-semibold">
            {scope === "review" ? "You are all caught up" : "You have covered everything here"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {scope === "review"
              ? "Nothing is due for review right now. Come back later and missed questions will be waiting."
              : "Every part of this material has been used for this question type and level. Try another type or level."}
          </p>
          <Link href="/documents" className="text-sm font-medium text-primary underline underline-offset-4">
            Back to documents
          </Link>
        </div>
      )}

      {current && (
        <section
          key={current.id}
          className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6 rounded-2xl border bg-card p-5 shadow-sm duration-300 sm:p-8"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground">
              Card {cardNumber}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground">{current.difficulty}</span>
            {current.topic && <span className="text-muted-foreground">{current.topic}</span>}
          </div>

          <p className="reading text-xl font-medium sm:text-2xl">{current.prompt}</p>

          {current.type === "mcq" ? (
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer options">
              {current.options?.map((o) => {
                const chosen = answer === o.key;
                const isRight = !!result && o.key === result.correctAnswer.trim().toUpperCase();
                const isWrong = !!result && chosen && !isRight;
                const tone = isRight
                  ? "border-success bg-success-soft"
                  : isWrong
                    ? "border-danger bg-danger-soft"
                    : chosen
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-primary/50";
                const badge = isRight
                  ? "bg-success text-white dark:text-background"
                  : isWrong
                    ? "bg-danger text-white dark:text-background"
                    : chosen
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground";
                return (
                  <label
                    key={o.key}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40 ${tone} ${
                      result ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={o.key}
                      className="sr-only"
                      checked={chosen}
                      disabled={!!result}
                      onChange={() => setAnswer(o.key)}
                    />
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${badge}`}
                    >
                      {isRight ? (
                        <Check className="size-3.5" aria-label="Correct answer" />
                      ) : isWrong ? (
                        <X className="size-3.5" aria-label="Your wrong answer" />
                      ) : (
                        o.key
                      )}
                    </span>
                    <span className="reading">{o.text}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <textarea
              className="reading min-h-44 w-full rounded-xl border-2 border-border bg-background p-4 text-base outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70"
              value={answer}
              disabled={!!result}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer in your own words"
              aria-label="Your answer"
            />
          )}

          {!result && current.type === "mcq" && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Tip: press <kbd className="rounded border px-1.5 py-0.5 font-sans">1</kbd> to{" "}
              <kbd className="rounded border px-1.5 py-0.5 font-sans">4</kbd> to choose and{" "}
              <kbd className="rounded border px-1.5 py-0.5 font-sans">Enter</kbd> to check.
            </p>
          )}

          {!result && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={submit} disabled={submitting || !answer.trim()} className="h-10 px-5 text-sm">
                {submitting ? "Checking..." : "Check answer"}
              </Button>
              {current.hint && !showHint && (
                <Button variant="ghost" onClick={() => setShowHint(true)} className="h-10 px-3 text-sm">
                  <Lightbulb data-icon="inline-start" />
                  Show hint
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={next}
                disabled={submitting || loading}
                className="h-10 px-3 text-sm text-muted-foreground sm:ml-auto"
              >
                Skip for now
                <SkipForward data-icon="inline-end" />
              </Button>
            </div>
          )}
          {showHint && !result && (
            <p className="reading rounded-xl bg-highlight/40 px-4 py-3 text-sm" role="note">
              <span className="font-sans font-semibold">Hint: </span>
              {current.hint}
            </p>
          )}

          {result && (
            <div className="animate-in fade-in slide-in-from-top-1 flex flex-col gap-6 border-t pt-6 duration-300">
              <div
                className={`animate-in slide-in-from-left-4 fade-in flex items-center justify-between gap-3 rounded-xl px-4 py-3 duration-500 ${
                  result.isCorrect ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                }`}
                role="status"
              >
                <span className="flex items-center gap-2 text-lg font-semibold">
                  {result.isCorrect ? (
                    <Check className="animate-in zoom-in-50 size-5 duration-300" aria-hidden />
                  ) : (
                    <X className="animate-in zoom-in-50 size-5 duration-300" aria-hidden />
                  )}
                  {result.isCorrect ? "Correct" : "Not quite"}
                </span>
                <span className="text-sm font-medium">
                  {result.score} of {result.maxScore} {result.maxScore === 1 ? "mark" : "marks"}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-semibold text-muted-foreground">Correct answer</h2>
                <p className="reading text-base">
                  {current.type === "mcq"
                    ? `${result.correctAnswer}. ${optionText(result.correctAnswer, result.options) ?? ""}`
                    : result.correctAnswer}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-semibold text-muted-foreground">Why</h2>
                <p className="reading text-base">{result.reasoning}</p>
              </div>

              {result.rubric.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-sm font-semibold text-muted-foreground">Where the marks went</h2>
                  <ul className="divide-y rounded-xl border">
                    {result.rubric.map((r) => (
                      <li key={r.point} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                        <span className="reading">{r.point}</span>
                        <span
                          className={`shrink-0 font-semibold ${
                            r.awarded >= r.marks ? "text-success" : r.awarded > 0 ? "text-foreground" : "text-danger"
                          }`}
                        >
                          {r.awarded} / {r.marks}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.missedPoints.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-sm font-semibold text-muted-foreground">What you missed</h2>
                  <ul className="reading list-disc pl-5 text-base">
                    {result.missedPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-semibold text-muted-foreground">From your notes</h2>
                <p className="reading border-l-4 border-highlight pl-4 text-base text-muted-foreground">
                  {result.sourceContext ? (
                    <>
                      {result.sourceContext.before}
                      <mark className="swipe">{result.sourceContext.match}</mark>
                      {result.sourceContext.after}
                    </>
                  ) : (
                    <mark className="swipe">{result.sourceQuote}</mark>
                  )}
                </p>
              </div>

              <VideosPanel
                key={current.id}
                questionId={current.id}
                trigger={result.isCorrect ? "correct_click" : "wrong"}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={next} disabled={loading} className="h-10 px-5 text-sm">
                  {loading ? "Loading..." : "Next question"}
                  {!loading && <ArrowRight data-icon="inline-end" />}
                </Button>
                <Button variant="ghost" onClick={report} disabled={reported || reporting} className="h-10 px-3 text-sm">
                  <Flag data-icon="inline-start" />
                  {reported ? "Reported" : reporting ? "Reporting..." : "Report this question"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
