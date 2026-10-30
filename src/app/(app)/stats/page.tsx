import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";

const VISIBLE_TOPICS = 8;

type Row = { is_correct: boolean | null; hint_used: boolean; questions: { topic: string | null } | null };

async function Stats() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select("is_correct, hint_used, questions(topic)")
    .is("deleted_at", null)
    .returns<Row[]>();

  if (error) return <p className="text-sm text-danger">{error.message}</p>;
  if (!data.length) {
    return (
      <EmptyState
        title="No answers yet"
        description="Practice a document and the topics you find hard will show up here, weakest first."
        href="/documents"
        action="Choose a document"
      />
    );
  }

  const byTopic = new Map<string, { total: number; wrong: number; hints: number }>();
  for (const a of data) {
    const topic = a.questions?.topic?.trim() || "Other";
    const t = byTopic.get(topic) ?? { total: 0, wrong: 0, hints: 0 };
    t.total += 1;
    if (!a.is_correct) t.wrong += 1;
    if (a.hint_used) t.hints += 1;
    byTopic.set(topic, t);
  }

  const rows = [...byTopic.entries()]
    .map(([topic, t]) => ({ topic, ...t, accuracy: Math.round(((t.total - t.wrong) / t.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);

  const total = data.length;
  const correct = data.filter((a) => a.is_correct).length;
  const hints = data.filter((a) => a.hint_used).length;

  const renderRow = (r: (typeof rows)[number]) => (
    <li key={r.topic} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">{r.topic}</span>
        <span className="text-muted-foreground">
          {r.accuracy}% right, {r.wrong} wrong of {r.total}
          {r.hints > 0 ? `, ${r.hints} with a hint` : ""}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-danger-soft"
        role="img"
        aria-label={`${r.topic}: ${r.accuracy} percent right`}
      >
        <div
          className="animate-in slide-in-from-left fill-mode-both h-full rounded-full bg-success duration-700"
          style={{ width: `${r.accuracy}%` }}
        />
      </div>
    </li>
  );

  return (
    <>
      <dl className="grid grid-cols-3 divide-x rounded-xl border bg-card">
        <div className="flex flex-col gap-0.5 px-4 py-4">
          <dt className="text-sm text-muted-foreground">Answers</dt>
          <dd className="text-2xl font-semibold">{total}</dd>
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-4">
          <dt className="text-sm text-muted-foreground">Accuracy</dt>
          <dd className="text-2xl font-semibold">{Math.round((correct / total) * 100)}%</dd>
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-4">
          <dt className="text-sm text-muted-foreground">Hints used</dt>
          <dd className="text-2xl font-semibold">{hints}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Topics, weakest first</h2>
        <ul className="flex flex-col gap-4">{rows.slice(0, VISIBLE_TOPICS).map(renderRow)}</ul>
        {rows.length > VISIBLE_TOPICS && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
              Show {rows.length - VISIBLE_TOPICS} more topics
            </summary>
            <ul className="mt-4 flex flex-col gap-4">{rows.slice(VISIBLE_TOPICS).map(renderRow)}</ul>
          </details>
        )}
      </section>
    </>
  );
}

export default function StatsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader title="Stats" description="See which topics need more work." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
        <Stats />
      </Suspense>
    </main>
  );
}
