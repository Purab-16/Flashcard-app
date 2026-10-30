import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BATCH = 20;

// Same fields the practice screen uses. No answer, no explanation.
const SAFE_FIELDS = "id, type, difficulty, topic, prompt, options, hint, max_score";

// Questions whose review is due now, most overdue first.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: due, error } = await supabase
    .from("review_state")
    .select("question_id, due_at")
    .not("question_id", "is", null)
    .is("deleted_at", null)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due.length) return NextResponse.json({ questions: [] });

  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select(SAFE_FIELDS)
    .in("id", due.map((d) => d.question_id))
    .eq("status", "active")
    .is("deleted_at", null);
  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  const order = new Map(due.map((d, i) => [d.question_id, i]));
  questions.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return NextResponse.json({ questions });
}

// Reviews never make new questions. The client calls this when its queue is empty.
export async function POST() {
  return NextResponse.json({ questions: [], done: true });
}
