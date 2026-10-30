import { NextResponse } from "next/server";
import { flowParams, flowPostBody, generateNext, listUnanswered } from "@/lib/questions/flow";
import { createClient } from "@/lib/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Questions of this type and difficulty that the user has not answered yet.
export async function GET(request: Request, { params: p }: { params: Promise<{ id: string }> }) {
  const { id } = await p;
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = flowParams.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type or difficulty" }, { status: 400 });

  const result = await listUnanswered(supabase, [id], parsed.data);
  return NextResponse.json(result.body, { status: result.status });
}

// Generates questions for the next chunk that has none yet. One chunk, one AI call.
export async function POST(request: Request, { params: p }: { params: Promise<{ id: string }> }) {
  const { id } = await p;
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = flowPostBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type or difficulty" }, { status: 400 });

  const result = await generateNext(supabase, user.id, [id], parsed.data, new Set(parsed.data.skip ?? []));
  return NextResponse.json(result.body, { status: result.status });
}
