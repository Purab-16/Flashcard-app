"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RetryButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Retry failed");
      }
    } catch {
      setError("Retry failed");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={retry} disabled={busy}>
        {busy ? "Retrying..." : "Retry"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
