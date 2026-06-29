import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("annotation_ratings")
      .select("image_name, stars, note, saved_at")
      .order("saved_at", { ascending: false });

    if (error) throw error;

    const ratings: Record<string, { stars: number | null; note: string | null; savedAt: string }> = {};
    for (const row of data ?? []) {
      ratings[row.image_name] = { stars: row.stars, note: row.note, savedAt: row.saved_at };
    }

    return NextResponse.json({ ratings });
  } catch (err) {
    console.error("[annotation/ratings]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { image_name } = await req.json() as { image_name: string };
    if (!image_name) return NextResponse.json({ error: "Missing image_name" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("annotation_ratings")
      .delete()
      .eq("image_name", image_name);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[annotation/ratings DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
