import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const body = z.object({ name: z.string().trim().min(1).max(60) });

// Creates a subject folder for the signed-in user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name (1 to 60 characters)" }, { status: 400 });

  const { data, error } = await supabase
    .from("subjects")
    .insert({ user_id: user.id, name: parsed.data.name })
    .select("id, name")
    .single();
  if (error) {
    // 23505 = unique violation (same live name already exists)
    if (error.code === "23505") return NextResponse.json({ error: "That subject already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
