import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AttemptRow = {
  is_correct: boolean | null;
  score: number | null;
  max_score: number | null;
  feedback: { skipped?: boolean } | null;
  questions: { type: string } | { type: string }[] | null;
};

const typeOf = (q: AttemptRow["questions"]) => (Array.isArray(q) ? q[0]?.type : q?.type);

// Adds up the marks, applies negative marking to wrong MCQs, and closes the test.
export async function POST(_request: Request, { params: p }: { params: Promise<{ id: string }> }) {
  const { id } = await p;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, finished_at, negative_marking")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  if (session.finished_at) return NextResponse.json({ ok: true });

  const { data: attempts, error } = await supabase
    .from("attempts")
    .select("is_correct, score, max_score, feedback, questions(type)")
    .eq("session_id", id)
    .is("deleted_at", null)
    .returns<AttemptRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const negative = Number(session.negative_marking);
  let total = 0;
  let max = 0;
  for (const a of attempts) {
    const maxScore = Number(a.max_score ?? 0);
    max += maxScore;
    total += Number(a.score ?? 0);
    // Only an answered, wrong MCQ loses marks. Skipped questions and partial written answers do not.
    if (negative > 0 && typeOf(a.questions) === "mcq" && a.is_correct === false && !a.feedback?.skipped) {
      total -= negative * maxScore;
    }
  }

  const { error: updateError } = await supabase
    .from("test_sessions")
    .update({ finished_at: new Date().toISOString(), total_score: total, max_score: max })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
