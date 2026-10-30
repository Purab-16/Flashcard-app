import { ArrowRight, CheckCheck, FileText, Flame, Target } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CardStack } from "@/components/shared/card-stack";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { usageToday } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";

async function Greeting() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PageHeader title="Today" description={user?.email ? `Signed in as ${user.email}` : undefined} />;
}

async function ReviewPanel() {
  await connection();
  const supabase = await createClient();
  const { count } = await supabase
    .from("review_state")
    .select("id", { count: "exact", head: true })
    .not("question_id", "is", null)
    .is("deleted_at", null)
    .lte("due_at", new Date().toISOString());
  const due = count ?? 0;

  return (
    <section className="flex items-center justify-between gap-6 overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-foreground sm:p-8">
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold text-white">
            {due > 0
              ? `${due} ${due === 1 ? "question is" : "questions are"} ready to review`
              : "Nothing to review right now"}
          </h2>
          <p className="max-w-md text-sm text-sidebar-foreground/75">
            {due > 0
              ? "Questions you got wrong come back first. Reviewing them now is what makes them stick."
              : "Practice a document and the questions you miss will show up here."}
          </p>
        </div>
        <Link
          href={due > 0 ? "/review" : "/documents"}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-highlight px-4 text-sm font-semibold text-highlight-foreground transition-all hover:bg-highlight/85 active:translate-y-px"
        >
          {due > 0 ? "Start review" : "Choose a document"}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <CardStack className="hidden sm:block" />
    </section>
  );
}

// One calendar day as text, in the server's time zone.
const dayKey = (d: Date) => d.toLocaleDateString("en-CA");

function StatTile({
  icon,
  label,
  value,
  tone = "bg-secondary text-primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-2xl leading-tight font-semibold">{value}</dd>
      </div>
    </div>
  );
}

async function Activity() {
  await connection();
  const supabase = await createClient();
  const today = new Date();
  const sinceDate = new Date(today);
  sinceDate.setDate(today.getDate() - 60);
  const since = sinceDate.toISOString();
  const { data } = await supabase
    .from("attempts")
    .select("created_at, is_correct")
    .is("deleted_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const perDay = new Map<string, { total: number; correct: number }>();
  for (const a of data ?? []) {
    const key = dayKey(new Date(a.created_at));
    const day = perDay.get(key) ?? { total: 0, correct: 0 };
    day.total += 1;
    if (a.is_correct) day.correct += 1;
    perDay.set(key, day);
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const stats = perDay.get(dayKey(d));
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      total: stats?.total ?? 0,
      correct: stats?.correct ?? 0,
      isToday: i === 6,
    };
  });

  // Days in a row with at least one answer. Today may still be empty, so it does not break the streak.
  let streak = 0;
  const cursor = new Date(today);
  if (!perDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (perDay.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const answeredToday = week[6].total;
  const weekTotal = week.reduce((t, d) => t + d.total, 0);
  const weekCorrect = week.reduce((t, d) => t + d.correct, 0);
  const max = Math.max(1, ...week.map((d) => d.total));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Your week</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={<CheckCheck className="size-5" aria-hidden />} label="Answered today" value={answeredToday} />
        <StatTile
          icon={<Flame className="size-5" aria-hidden />}
          label="Day streak"
          value={streak}
          tone={streak > 0 ? "bg-highlight text-highlight-foreground" : "bg-secondary text-muted-foreground"}
        />
        <StatTile
          icon={<Target className="size-5" aria-hidden />}
          label="Right this week"
          value={weekTotal ? `${Math.round((weekCorrect / weekTotal) * 100)}%` : "None yet"}
        />
      </dl>

      <div className="rounded-xl border bg-card p-5">
        <div className="relative">
          {/* faint guide lines behind the bars */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-9 flex flex-col justify-between" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="border-t border-dashed border-border" />
            ))}
          </div>
          <ul className="relative flex h-36 items-end gap-3" aria-label="Answers per day, last 7 days">
            {week.map((d, i) => (
              <li key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs text-muted-foreground">{d.total || ""}</span>
                <div
                  className={`animate-in slide-in-from-bottom-4 fade-in fill-mode-both w-full max-w-10 rounded-md duration-500 ${
                    d.isToday ? "bg-primary" : d.total ? "bg-chart-3" : "bg-muted"
                  }`}
                  style={{ height: `${Math.max(5, (d.total / max) * 78)}%`, animationDelay: `${300 + i * 60}ms` }}
                  role="img"
                  aria-label={`${d.label}: ${d.total} answers`}
                />
                <span className={`text-xs ${d.isToday ? "font-semibold" : "text-muted-foreground"}`}>{d.label}</span>
              </li>
            ))}
          </ul>
        </div>
        {weekTotal === 0 && (
          <p className="pt-3 text-center text-sm text-muted-foreground">
            Answer a question and today&apos;s bar will grow here.
          </p>
        )}
      </div>
    </section>
  );
}

async function RecentDocuments() {
  await connection();
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("status", "chunked")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(4);

  if (!docs?.length) {
    return (
      <EmptyState
        title="No notes yet"
        description="Upload a PDF, a text file or a photo of your notes and questions will be made from them."
        href="/documents"
        action="Upload your first notes"
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Continue practicing</h2>
        <Link href="/documents" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          All documents
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {docs.map((d) => (
          <li key={d.id}>
            <Link
              href={`/practice/${d.id}?type=mcq&difficulty=medium`}
              className="group flex h-full items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <FileText className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{d.title}</span>
                <span className="text-sm text-muted-foreground">MCQ, medium</span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function UsageMeter() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { used, limit } = await usageToday(supabase, user.id);
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="text-base font-semibold">AI use today</h2>
        <span className="text-sm text-muted-foreground">
          {used} of {limit} calls in the last 24 hours
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="AI calls used"
      >
        <div className={`h-full rounded-full ${percent >= 90 ? "bg-danger" : "bg-primary"}`} style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}

const skeleton = <div className="h-24 animate-pulse rounded-xl bg-muted" />;

// The page opens with one staggered entrance, then stays still.
function Reveal({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${step * 90}ms` }}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-8">
      <Reveal step={0}>
        <Suspense fallback={<PageHeader title="Today" />}>
          <Greeting />
        </Suspense>
      </Reveal>
      <Reveal step={1}>
        <Suspense fallback={skeleton}>
          <ReviewPanel />
        </Suspense>
      </Reveal>
      <Reveal step={2}>
        <Suspense fallback={skeleton}>
          <Activity />
        </Suspense>
      </Reveal>
      <Reveal step={3}>
        <Suspense fallback={skeleton}>
          <RecentDocuments />
        </Suspense>
      </Reveal>
      <Reveal step={4}>
        <Suspense fallback={null}>
          <UsageMeter />
        </Suspense>
      </Reveal>
    </main>
  );
}
