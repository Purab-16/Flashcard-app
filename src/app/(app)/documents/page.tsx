import { FileText } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { PracticeLauncher } from "./practice-launcher";
import { RemoveButton } from "./remove-button";
import { RetryButton } from "./retry-button";
import { SubjectForm } from "./subject-form";
import { UploadForm } from "./upload-form";

type Doc = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  subject_id: string | null;
};

const STATUS: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Waiting to be read", className: "bg-secondary text-secondary-foreground" },
  parsed: { label: "Splitting text", className: "bg-secondary text-secondary-foreground" },
  chunked: { label: "Ready", className: "bg-success-soft text-success" },
  failed: { label: "Could not read", className: "bg-danger-soft text-danger" },
};

function DocumentItem({ d }: { d: Doc }) {
  const status = STATUS[d.status] ?? STATUS.uploaded;
  return (
    <li className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-medium break-words">{d.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.status === "failed" && <RetryButton documentId={d.id} />}
          {d.status === "chunked" && <PracticeLauncher id={d.id} />}
          <RemoveButton
            endpoint={`/api/documents/${d.id}/remove`}
            name={d.title}
            warning="Remove this document and its questions from your lists?"
          />
        </div>
      </div>
      {d.error && (
        <p className={`text-sm ${d.status === "failed" ? "text-danger" : "text-muted-foreground"}`}>{d.error}</p>
      )}
    </li>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();

  const [subjectsRes, docsRes] = await Promise.all([
    supabase.from("subjects").select("id, name").is("deleted_at", null).order("name", { ascending: true }),
    supabase
      .from("documents")
      .select("id, title, status, error, subject_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (subjectsRes.error) return <p className="text-sm text-danger">{subjectsRes.error.message}</p>;
  if (docsRes.error) return <p className="text-sm text-danger">{docsRes.error.message}</p>;

  const subjects = subjectsRes.data;
  const docs = docsRes.data;

  const groups = [
    ...subjects.map((s) => ({ key: s.id, name: s.name, docs: docs.filter((d) => d.subject_id === s.id) })),
    { key: "none", name: "No subject", docs: docs.filter((d) => !d.subject_id) },
  ].filter((g) => g.docs.length > 0);

  return (
    <>
      <UploadForm subjects={subjects} />
      <SubjectForm />
      {groups.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Upload a PDF, DOCX, text file or a photo of your notes above to get started."
        />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{g.name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {g.key !== "none" && g.docs.some((d) => d.status === "chunked") && (
                  <PracticeLauncher id={g.key} scope="subject" />
                )}
                {g.key !== "none" && (
                  <RemoveButton
                    endpoint={`/api/subjects/${g.key}/remove`}
                    name={`subject ${g.name}`}
                    warning="Remove this subject? Its documents stay and move to No subject."
                  />
                )}
              </div>
            </div>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {g.docs.map((d) => (
                <DocumentItem key={d.id} d={d} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

export default function DocumentsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-8">
      <PageHeader title="Documents" description="Upload your notes, then practice them by type and difficulty." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
        <Content />
      </Suspense>
    </main>
  );
}
