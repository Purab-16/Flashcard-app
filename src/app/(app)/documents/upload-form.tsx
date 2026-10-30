"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";

// A crashed server sends an empty body. Show a plain message instead of "JSON.parse" text.
async function readJson(res: Response): Promise<{ id?: string; error?: string }> {
  try {
    return await res.json();
  } catch {
    return { error: `The server had a problem (code ${res.status}). Please try again in a moment.` };
  }
}

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp";
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function UploadForm({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const subjectId = String(data.get("subjectId") ?? "") || null;
    if (!(file instanceof File) || file.size === 0) return setError("Choose a file first.");
    if (file.size > MAX_BYTES) return setError("File is larger than 15 MB.");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) return setError("Unsupported file type.");

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You are signed out. Log in again.");

      setStep("Uploading...");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: mimeType });
      if (uploadError) throw new Error(uploadError.message);

      setStep("Saving...");
      const created = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ""),
          storagePath,
          mimeType,
          subjectId,
        }),
      });
      const createdBody = await readJson(created);
      if (!created.ok) throw new Error(createdBody.error ?? "Could not save the document");

      setStep("Reading and splitting the text...");
      const processed = await fetch(`/api/documents/${createdBody.id}/process`, { method: "POST" });
      const processedBody = await readJson(processed);
      if (!processed.ok) throw new Error(processedBody.error ?? "Could not read the document");

      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      router.refresh();
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border-2 border-dashed bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Upload className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">Add notes</h2>
          <p className="text-sm text-muted-foreground">PDF, DOCX, text file or a photo. Up to 15 MB.</p>
        </div>
      </div>
      <Input
        name="file"
        type="file"
        accept={ACCEPT}
        disabled={busy}
        aria-label="Choose a file"
        className="h-11 cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium file:text-secondary-foreground hover:border-primary/50"
      />
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect name="subjectId" defaultValue="" disabled={busy} aria-label="Subject">
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={busy} className="h-9 px-4">
          {busy ? "Working..." : "Upload and read"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Scanned PDFs (pages that are only pictures) are read with AI. That uses one AI call per page, up to 20 pages.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {busy && (
        <p className="text-sm text-muted-foreground" role="status">
          {step}
        </p>
      )}
    </form>
  );
}
