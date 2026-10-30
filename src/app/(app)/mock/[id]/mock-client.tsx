"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { clearMock, readMockRaw, saveMock, subscribeMock, type MockData } from "../mock-store";

const formatTime = (sec: number) => {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function MockClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const raw = useSyncExternalStore(
    subscribeMock,
    () => readMockRaw(sessionId),
    () => null,
  );
  const data = useMemo<MockData | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MockData;
    } catch {
      return null;
    }
  }, [raw]);

  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  // Clock tick. State is only set inside timer callbacks.
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const remaining = data && now ? Math.ceil((data.endsAt - now) / 1000) : null;

  async function submit() {
    if (!data || submitting.current) return;
    submitting.current = true;
    setError("");
    const total = data.questions.length;
    setProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i++) {
        const q = data.questions[i];
        // Retry a question once if the AI was busy, so one hiccup does not lose the test.
        for (let attempt = 0; ; attempt++) {
          const res = await fetch(`/api/mock/${sessionId}/grade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: q.id,
              answer: data.answers[q.id] ?? "",
            }),
          });
          if (res.ok) break;
          if (attempt >= 1) throw new Error((await res.json()).error ?? "Could not check an answer");
        }
        setProgress({ done: i + 1, total });
      }
      const finished = await fetch(`/api/mock/${sessionId}/finish`, { method: "POST" });
      if (!finished.ok) throw new Error((await finished.json()).error ?? "Could not finish the test");
      clearMock(sessionId);
      router.push(`/mock/${sessionId}/report`);
    } catch (e) {
      // Answers already checked are kept. Pressing submit again continues from where it stopped.
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setProgress(null);
      submitting.current = false;
    }
  }

  // Time is up: submit what has been answered.
  useEffect(() => {
    if (remaining === null || remaining > 0) return;
    const timer = setTimeout(() => void submit(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === null ? null : remaining <= 0]);

  function setAnswer(questionId: string, value: string) {
    if (!data) return;
    saveMock(sessionId, { ...data, answers: { ...data.answers, [questionId]: value } });
  }

  const go = (to: number) => setIndex(to);

  if (!data) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-start gap-3 p-4 sm:p-8">
        <h1 className="text-3xl font-semibold">This test is no longer open</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          A running test is kept in this browser tab. It was closed or already submitted. If you submitted it, the result is in
          your mock test report.
        </p>
        <Link href="/mock" className="text-sm font-medium text-primary underline underline-offset-4">
          Start a new mock test
        </Link>
      </main>
    );
  }

  const q = data.questions[index];
  const answered = data.questions.filter((x) => (data.answers[x.id] ?? "").trim()).length;

  if (progress) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-8" role="status">
        <h1 className="text-3xl font-semibold">Checking your answers</h1>
        <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {progress.done} of {progress.total} checked. Keep this page open until it finishes.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Mock test</h1>
        <p
          className={`rounded-full px-4 py-1.5 text-lg font-semibold tabular-nums text-white ${
            remaining !== null && remaining <= 60 ? "bg-danger" : "bg-sidebar"
          }`}
          role="timer"
          aria-label="Time left"
        >
          {remaining === null ? "--:--" : formatTime(remaining)}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jump to a question">
        {data.questions.map((x, i) => {
          const done = (data.answers[x.id] ?? "").trim();
          const tone =
            i === index
              ? "border-primary bg-primary text-primary-foreground"
              : done
                ? "border-success/40 bg-success-soft text-success"
                : "border-border bg-card text-muted-foreground hover:border-primary/50";
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => go(i)}
              className={`size-9 rounded-lg border text-sm font-medium transition-colors ${tone}`}
              aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
              aria-current={i === index ? "step" : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <p className="text-sm text-muted-foreground">
          Question {index + 1} of {data.questions.length}, {q.max_score} {q.max_score === 1 ? "mark" : "marks"}
        </p>
        <p className="reading text-xl font-medium sm:text-2xl">{q.prompt}</p>
        {q.type === "mcq" ? (
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer options">
            {q.options?.map((o) => {
              const chosen = data.answers[q.id] === o.key;
              return (
                <label
                  key={o.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40 ${
                    chosen ? "border-primary bg-secondary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`option-${q.id}`}
                    className="sr-only"
                    checked={chosen}
                    onChange={() => setAnswer(q.id, o.key)}
                  />
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      chosen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.key}
                  </span>
                  <span className="reading">{o.text}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <textarea
            className="reading min-h-44 w-full rounded-xl border-2 border-border bg-background p-4 text-base outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
            value={data.answers[q.id] ?? ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            placeholder="Write your answer in your own words"
            aria-label="Your answer"
          />
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 px-4 text-sm" disabled={index === 0} onClick={() => go(index - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            className="h-10 px-4 text-sm"
            disabled={index === data.questions.length - 1}
            onClick={() => go(index + 1)}
          >
            Next
          </Button>
        </div>
        <Button onClick={submit} className="h-10 px-5 text-sm">
          Submit test ({answered} of {data.questions.length} answered)
        </Button>
      </div>
    </main>
  );
}
