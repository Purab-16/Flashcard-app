import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Removes a subject folder. Soft delete only. Its documents are kept and move to "No subject".
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: subject, error: findError } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const { error: moveError } = await supabase.from("documents").update({ subject_id: null }).eq("subject_id", id);
  if (moveError) return NextResponse.json({ error: moveError.message }, { status: 500 });

  const { error } = await supabase.from("subjects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
