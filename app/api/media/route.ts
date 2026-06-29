import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { sanitizeStorageKey } from "@/lib/storageKey";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file")    as File   | null;
    const visitId  = formData.get("visitId") as string | null;
    const doctorId = formData.get("doctorId") as string | null;

    if (!file)    return NextResponse.json({ error: "No file"    }, { status: 400 });
    if (!visitId) return NextResponse.json({ error: "No visitId" }, { status: 400 });

    const filename    = `visits/${visitId}/${Date.now()}-${sanitizeStorageKey(file.name)}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filename, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("uploads")
      .getPublicUrl(filename);

    const media = await prisma.visitMedia.create({
      data: {
        visitId,
        mediaType:     file.type.startsWith("video") ? "video" : "image",
        filename:      file.name,
        storageUrl:    publicUrl,
        mimeType:      file.type,
        sizeBytes:     file.size,
        captureSource: "upload",
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (err: any) {
    console.error("[/api/media POST]", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const visitId  = searchParams.get("visitId");
    const doctorId = searchParams.get("doctorId");

    const media = await prisma.visitMedia.findMany({
      where: {
        ...(visitId ? { visitId } : {}),
      },
      include: { visit: true },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ media });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}