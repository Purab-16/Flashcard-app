"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "short", label: "Short answer" },
  { value: "long", label: "Long answer" },
] as const;

const LEVELS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1 text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/50 hover:bg-secondary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// One Practice button. What to practice (type and level) is kept in a small menu so rows stay clean.
export function PracticeLauncher({ id, scope }: { id: string; scope?: "subject" }) {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("mcq");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["value"]>("medium");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      } else if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const typeLabel = TYPES.find((t) => t.value === type)?.label;
  const levelLabel = LEVELS.find((l) => l.value === level)?.label;

  return (
    <form action={`/practice/${id}`} method="get" className="flex items-center gap-2">
      {scope && <input type="hidden" name="scope" value={scope} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="difficulty" value={level} />

      <Button type="submit" className="h-9 px-4">
        {scope ? "Practice subject" : "Practice"}
      </Button>

      <div ref={box} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          {typeLabel}, {levelLabel}
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>

        {open && (
          <div className="animate-in fade-in zoom-in-95 absolute top-full left-0 z-20 mt-2 flex w-72 flex-col gap-4 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg duration-150 sm:left-auto sm:right-0">
            <Choice legend="Question type" options={TYPES} value={type} onChange={setType} />
            <Choice legend="Difficulty" options={LEVELS} value={level} onChange={setLevel} />
          </div>
        )}
      </div>
    </form>
  );
}
