import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const body = z.object({
  scope: z.enum(["document", "subject"]),
  id: z.uuid(),
  type: z.enum(["mcq", "short", "long", "mixed"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(3).max(20),
  minutes: z.number().int().min(1).max(180),
  // Fraction of a question's marks lost for a wrong MCQ answer.
  negative: z.number().min(0).max(1),
});

// Same fields as practice. No answer, no explanation until the test is over.
const SAFE_FIELDS = "id, type, difficulty, topic, prompt, options, hint, max_score";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Starts a mock test from questions that already exist. No AI call here.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid test settings" }, { status: 400 });
  const { scope, id, type, difficulty, count, minutes, negative } = parsed.data;

  let documentIds: string[] = [id];
  if (scope === "subject") {
    const { data: docs, error } = await supabase
      .from("documents")
      .select("id")
      .eq("subject_id", id)
      .eq("status", "chunked")
      .is("deleted_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    documentIds = docs.map((d) => d.id);
  }
  if (!documentIds.length) return NextResponse.json({ error: "No documents found" }, { status: 404 });

  let query = supabase
    .from("questions")
    .select(SAFE_FIELDS)
    .in("document_id", documentIds)
    .eq("difficulty", difficulty)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(500);
  if (type !== "mixed") query = query.eq("type", type);
  const { data: pool, error: poolError } = await query;
  if (poolError) return NextResponse.json({ error: poolError.message }, { status: 500 });
  if (!pool.length) {
    return NextResponse.json(
      { error: "No questions yet for these settings. Practice this material first so questions exist." },
      { status: 404 },
    );
  }

  const questions = shuffle(pool).slice(0, count);

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .insert({
      user_id: user.id,
      mode: "mock",
      subject_id: scope === "subject" ? id : null,
      time_limit_sec: minutes * 60,
      negative_marking: negative,
    })
    .select("id")
    .single();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  return NextResponse.json({ id: session.id, questions, timeLimitSec: minutes * 60 });
}
