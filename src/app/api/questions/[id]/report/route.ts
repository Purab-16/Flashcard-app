import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const body = z.object({ reason: z.string().max(500).optional() });

// Saves a report and flags the question so it is not shown again. Nothing is deleted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reason" }, { status: 400 });

  const { data: question, error: findError } = await supabase
    .from("questions")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const { error: reportError } = await supabase
    .from("question_reports")
    .insert({ user_id: user.id, question_id: id, reason: parsed.data.reason ?? null });
  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 });

  const { error: flagError } = await supabase.from("questions").update({ status: "flagged" }).eq("id", id);
  if (flagError) return NextResponse.json({ error: flagError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
