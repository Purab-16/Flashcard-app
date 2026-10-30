import { NextResponse } from "next/server";
import { z } from "zod";
import { logUsage } from "@/lib/ai/usage";
import { usageToday } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { getVideos } from "@/lib/youtube";

const query = z.object({ questionId: z.uuid() });

// Videos for the topic of a question. The browser decides when to ask (auto on wrong, click on correct).
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid question" }, { status: 400 });

  const { data: q, error } = await supabase
    .from("questions")
    .select("topic, prompt, documents(title)")
    .eq("id", parsed.data.questionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const topic = q.topic?.trim() || q.prompt.slice(0, 80);
  const doc = q.documents as { title: string } | { title: string }[] | null;
  const docTitle = Array.isArray(doc) ? doc[0]?.title : doc?.title;
  try {
    const { videos, usage } = await getVideos(
      { topic, docTitle, question: q.prompt },
      (await usageToday(supabase, user.id)).remaining > 0,
    );
    if (usage) await logUsage(supabase, user.id, usage);
    return NextResponse.json({ topic, videos });
  } catch (e) {
    console.error("getVideos failed:", e);
    return NextResponse.json({ error: "Could not load videos right now." }, { status: 502 });
  }
}
