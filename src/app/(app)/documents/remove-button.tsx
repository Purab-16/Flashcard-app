"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  endpoint: string;
  // What is being removed, for the button label for screen readers. For example "Web Tech Notes".
  name: string;
  // One short sentence that says what will and will not happen.
  warning: string;
};

// Two steps, so a document is never removed by one stray click.
export function RemoveButton({ endpoint, name, warning }: Props) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not remove");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`Remove ${name}`}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-right-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm duration-200"
      role="alert"
    >
      <span className="text-danger">{warning}</span>
      <Button size="sm" variant="destructive" onClick={remove} disabled={busy} className="h-8 px-3">
        {busy ? "Removing..." : "Yes, remove"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={busy} className="h-8 px-3">
        Cancel
      </Button>
      {error && <span className="w-full text-danger">{error}</span>}
    </div>
  );
}
