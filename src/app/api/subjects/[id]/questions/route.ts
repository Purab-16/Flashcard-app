import { NextResponse } from "next/server";
import { flowParams, flowPostBody, generateNext, listUnanswered } from "@/lib/questions/flow";
import { createClient } from "@/lib/supabase/server";

async function context(subjectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, documentIds: [] as string[] };

  // Only documents that are read and split, oldest first.
  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("status", "chunked")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return { supabase, user, documentIds: (docs ?? []).map((d) => d.id) };
}

// Unanswered questions from every document in the subject.
export async function GET(request: Request, { params: p }: { params: Promise<{ id: string }> }) {
  const { id } = await p;
  const { supabase, user, documentIds } = await context(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = flowParams.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type or difficulty" }, { status: 400 });

  const result = await listUnanswered(supabase, documentIds, parsed.data);
  return NextResponse.json(result.body, { status: result.status });
}

// Generates questions for the next chunk without any, going through the subject's documents in order.
export async function POST(request: Request, { params: p }: { params: Promise<{ id: string }> }) {
  const { id } = await p;
  const { supabase, user, documentIds } = await context(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = flowPostBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type or difficulty" }, { status: 400 });

  const result = await generateNext(supabase, user.id, documentIds, parsed.data, new Set(parsed.data.skip ?? []));
  return NextResponse.json(result.body, { status: result.status });
}
