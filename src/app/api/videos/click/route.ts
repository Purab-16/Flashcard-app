import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const body = z.object({
  questionId: z.uuid(),
  videoId: z.string().min(1).max(32),
  trigger: z.enum(["wrong", "correct_click"]),
});

// Saves that the user opened a video.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid click" }, { status: 400 });

  const { error } = await supabase.from("video_clicks").insert({
    user_id: user.id,
    question_id: parsed.data.questionId,
    video_id: parsed.data.videoId,
    trigger: parsed.data.trigger,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
