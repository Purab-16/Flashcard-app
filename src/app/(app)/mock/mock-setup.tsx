"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveMock } from "./mock-store";

type Item = { id: string; name: string };

type Props = {
  subjects: Item[];
  documents: { id: string; title: string }[];
};

export function MockSetup({ subjects, documents }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    const target = String(data.get("target") ?? "");
    if (!target) return setError("Choose a document or subject.");
    const [scope, id] = target.split(":");

    setBusy(true);
    try {
      const res = await fetch("/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          id,
          type: data.get("type"),
          difficulty: data.get("difficulty"),
          count: Number(data.get("count")),
          minutes: Number(data.get("minutes")),
          negative: Number(data.get("negative")),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start the test");

      saveMock(body.id, {
        questions: body.questions,
        endsAt: Date.now() + body.timeLimitSec * 1000,
        answers: {},
      });
      router.push(`/mock/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">Upload and read a document first.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor="target">Material</Label>
        <NativeSelect id="target" name="target" defaultValue="" disabled={busy} className="w-full">
          <option value="" disabled>
            Choose...
          </option>
          {subjects.length > 0 && (
            <optgroup label="Subjects (all documents)">
              {subjects.map((s) => (
                <option key={s.id} value={`subject:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Documents">
            {documents.map((d) => (
              <option key={d.id} value={`document:${d.id}`}>
                {d.title}
              </option>
            ))}
          </optgroup>
        </NativeSelect>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="type">Question type</Label>
          <NativeSelect id="type" name="type" defaultValue="mixed" disabled={busy} className="w-full">
            <option value="mixed">Mixed</option>
            <option value="mcq">MCQ</option>
            <option value="short">Short answer</option>
            <option value="long">Long answer</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="difficulty">Difficulty</Label>
          <NativeSelect id="difficulty" name="difficulty" defaultValue="medium" disabled={busy} className="w-full">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="count">Questions (3 to 20)</Label>
          <Input id="count" name="count" type="number" min={3} max={20} defaultValue={10} disabled={busy} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="minutes">Time in minutes</Label>
          <Input id="minutes" name="minutes" type="number" min={1} max={180} defaultValue={15} disabled={busy} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="negative">Negative marking (wrong MCQ)</Label>
          <NativeSelect id="negative" name="negative" defaultValue="0" disabled={busy} className="w-full">
            <option value="0">None</option>
            <option value="0.25">Lose 1/4 of the marks</option>
            <option value="0.5">Lose 1/2 of the marks</option>
            <option value="1">Lose all the marks</option>
          </NativeSelect>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy} className="h-10 self-start px-5 text-sm">
        {busy ? "Starting..." : "Start test"}
      </Button>
    </form>
  );
}
