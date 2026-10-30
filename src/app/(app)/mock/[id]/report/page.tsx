import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type Q = {
  type: "mcq" | "short" | "long";
  prompt: string;
  topic: string | null;
  options: { key: string; text: string }[] | null;
  correct_answer: string;
  explanation: string;
};

type Attempt = {
  id: string;
  is_correct: boolean | null;
  score: number | null;
  max_score: number | null;
  answer_text: string | null;
  selected_option: string | null;
  feedback: { skipped?: boolean; reasoning?: string; missedPoints?: string[] } | null;
  created_at: string;
  questions: Q | Q[] | null;
};

const num = (n: number) => String(Math.round(n * 100) / 100);

async function Report({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, finished_at, total_score, max_score, negative_marking, time_limit_sec, started_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!session) return <p className="text-sm">Test not found.</p>;
  if (!session.finished_at) {
    return (
      <p className="text-sm">
        This test is not finished yet. <Link href={`/mock/${id}`} className="underline">Go back to it</Link>.
      </p>
    );
  }

  const { data: attempts, error } = await supabase
    .from("attempts")
    .select(
      "id, is_correct, score, max_score, answer_text, selected_option, feedback, created_at, questions(type, prompt, topic, options, correct_answer, explanation)",
    )
    .eq("session_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<Attempt[]>();
  if (error) return <p className="text-sm text-danger">{error.message}</p>;

  const total = Number(session.total_score ?? 0);
  const max = Number(session.max_score ?? 0);
  const percent = max > 0 ? Math.round((total / max) * 100) : 0;
  const skipped = attempts.filter((a) => a.feedback?.skipped).length;
  const correct = attempts.filter((a) => a.is_correct).length;
  const wrong = attempts.length - correct - skipped;
  const spentSec = Math.round((new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000);

  return (
    <>
      <section className="flex flex-col gap-4 rounded-2xl bg-sidebar p-6 text-sidebar-foreground">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-sidebar-foreground/75">Your score</p>
            <p className="text-5xl font-semibold tracking-tight text-white">
              {num(total)}
              <span className="text-2xl text-sidebar-foreground/70"> / {num(max)}</span>
            </p>
          </div>
          <p className="rounded-full bg-highlight px-4 py-1.5 text-lg font-semibold text-highlight-foreground">{percent}%</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-sidebar-border pt-4 text-sm">
          <div>
            <dt className="text-sidebar-foreground/70">Correct</dt>
            <dd className="text-xl font-semibold text-white">{correct}</dd>
          </div>
          <div>
            <dt className="text-sidebar-foreground/70">Not correct</dt>
            <dd className="text-xl font-semibold text-white">{wrong}</dd>
          </div>
          <div>
            <dt className="text-sidebar-foreground/70">Skipped</dt>
            <dd className="text-xl font-semibold text-white">{skipped}</dd>
          </div>
        </dl>
      </section>
      <p className="text-sm text-muted-foreground">
        Time used: {Math.floor(spentSec / 60)} min {spentSec % 60} s
        {Number(session.negative_marking) > 0
          ? `. Negative marking: a wrong MCQ loses ${Number(session.negative_marking) * 100}% of its marks.`
          : ""}
      </p>

      <ol className="flex flex-col gap-4">
        {attempts.map((a, i) => {
          const q = Array.isArray(a.questions) ? a.questions[0] : a.questions;
          if (!q) return null;
          const wasSkipped = !!a.feedback?.skipped;
          const yours = q.type === "mcq" ? a.selected_option : a.answer_text;
          const optionText = (key: string | null) => q.options?.find((o) => o.key === key)?.text;
          const badge = wasSkipped
            ? "bg-secondary text-secondary-foreground"
            : a.is_correct
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger";
          return (
            <li key={a.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Question {i + 1}
                  {q.topic ? `, ${q.topic}` : ""}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
                  {wasSkipped ? "Skipped" : a.is_correct ? "Correct" : "Not correct"} ({num(Number(a.score ?? 0))} of{" "}
                  {num(Number(a.max_score ?? 0))})
                </span>
              </div>
              <p className="reading text-lg font-medium">{q.prompt}</p>
              {!wasSkipped && (
                <p className="reading text-base">
                  <span className="font-sans text-sm font-semibold text-muted-foreground">Your answer: </span>
                  {q.type === "mcq" ? `${yours}. ${optionText(yours) ?? ""}` : yours}
                </p>
              )}
              <p className="reading text-base">
                <span className="font-sans text-sm font-semibold text-muted-foreground">Correct answer: </span>
                {q.type === "mcq" ? `${q.correct_answer}. ${optionText(q.correct_answer) ?? ""}` : q.correct_answer}
              </p>
              <p className="reading text-base text-muted-foreground">{a.feedback?.reasoning ?? q.explanation}</p>
              {a.feedback?.missedPoints && a.feedback.missedPoints.length > 0 && (
                <ul className="reading list-disc pl-5 text-base">
                  {a.feedback.missedPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function MockReportPage(props: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader title="Mock test report">
        <Link href="/mock" className={buttonVariants({ variant: "outline", className: "h-9 px-4" })}>
          New test
        </Link>
      </PageHeader>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
        <Report params={props.params} />
      </Suspense>
    </main>
  );
}
