import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { MockSetup } from "./mock-setup";

async function Setup() {
  await connection();
  const supabase = await createClient();
  const [subjects, docs] = await Promise.all([
    supabase.from("subjects").select("id, name").is("deleted_at", null).order("name", { ascending: true }),
    supabase
      .from("documents")
      .select("id, title")
      .eq("status", "chunked")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (subjects.error) return <p className="text-sm text-danger">{subjects.error.message}</p>;
  if (docs.error) return <p className="text-sm text-danger">{docs.error.message}</p>;

  return <MockSetup subjects={subjects.data} documents={docs.data} />;
}

export default function MockPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        title="Mock test"
        description="A timed test from questions you already have, so practice a document first. Answers and marks appear after you submit."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
        <Setup />
      </Suspense>
    </main>
  );
}
