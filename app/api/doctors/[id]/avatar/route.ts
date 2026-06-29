import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing doctor ID" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(`${id}.jpg`, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Avatar upload error]", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(`${id}.jpg`);

    // Cache-bust so the new image shows up immediately
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    // Try Doctor first; if not found, fall back to Admin
    const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });
    if (doctor) {
      const updated = await prisma.doctor.update({
        where: { id },
        data: { avatarUrl: publicUrl },
        select: { avatarUrl: true },
      });
      return NextResponse.json({ avatarUrl: updated.avatarUrl });
    }

    const admin = await prisma.admin.findUnique({ where: { id }, select: { id: true } });
    if (admin) {
      const updated = await prisma.admin.update({
        where: { id },
        data: { avatarUrl: publicUrl },
        select: { avatarUrl: true },
      });
      return NextResponse.json({ avatarUrl: updated.avatarUrl });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (err: unknown) {
    console.error("[POST /api/doctors/:id/avatar]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}