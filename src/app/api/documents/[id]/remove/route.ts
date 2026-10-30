import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Removes a document from the user's lists. Soft delete only: rows get `deleted_at`, nothing is erased.
// Its chunks, questions and review schedule are hidden too, so old questions do not keep showing up in Review.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: doc, error: findError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const now = new Date().toISOString();

  const { data: questions, error: questionError } = await supabase
    .from("questions")
    .update({ deleted_at: now })
    .eq("document_id", id)
    .is("deleted_at", null)
    .select("id");
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });

  const questionIds = (questions ?? []).map((q) => q.id);
  if (questionIds.length) {
    const { error: reviewError } = await supabase
      .from("review_state")
      .update({ deleted_at: now })
      .in("question_id", questionIds)
      .is("deleted_at", null);
    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  const { error: chunkError } = await supabase
    .from("chunks")
    .update({ deleted_at: now })
    .eq("document_id", id)
    .is("deleted_at", null);
  if (chunkError) return NextResponse.json({ error: chunkError.message }, { status: 500 });

  const { error } = await supabase.from("documents").update({ deleted_at: now }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
