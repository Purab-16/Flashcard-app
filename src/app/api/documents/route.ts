import { NextResponse } from "next/server";
import { z } from "zod";
import { ALLOWED_MIMES } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";

const body = z.object({
  title: z.string().min(1).max(200),
  storagePath: z.string().min(1),
  mimeType: z.string().refine((m) => ALLOWED_MIMES.includes(m), "Unsupported file type"),
  subjectId: z.uuid().nullish(),
});

// Creates the documents row after the browser has uploaded the file to Storage.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { title, storagePath, mimeType, subjectId } = parsed.data;

  // Files must live in the user's own folder.
  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  // The subject must be one of the user's own live subjects (RLS hides other users' rows).
  if (subjectId) {
    const { data: subject } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", subjectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      subject_id: subjectId ?? null,
      title,
      storage_path: storagePath,
      mime_type: mimeType,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
