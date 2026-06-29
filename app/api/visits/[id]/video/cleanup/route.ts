import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseStorage as supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function urlToStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = "/storage/v1/object/public/uploads/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await context.params;
    const { mediaId, transcodedPath } = await req.json();

    if (!mediaId) {
      return NextResponse.json({ error: "mediaId required" }, { status: 400 });
    }

    // 1. جيب كل frames بدون detection
    const normalFrames = await prisma.videoFrame.findMany({
      where:  { mediaId, hasDetection: false },
      select: { id: true, frameUrl: true },
    });

    // 2. استخرج storage paths
    const pathsToDelete: string[] = [];
    for (const f of normalFrames) {
      if (f.frameUrl) {
        const p = urlToStoragePath(f.frameUrl);
        if (p) pathsToDelete.push(p);
      }
    }

    // 3. احذف من Supabase storage (max 100 per request)
    let deletedFiles = 0;
    for (let i = 0; i < pathsToDelete.length; i += 100) {
      const batch = pathsToDelete.slice(i, i + 100);
      const { error } = await supabase.storage.from("uploads").remove(batch);
      if (!error) deletedFiles += batch.length;
    }

    // 4. حدّث DB — frameUrl = "" على الـ frames المحذوفة من storage
    await prisma.videoFrame.updateMany({
      where: { mediaId, hasDetection: false },
      data:  { frameUrl: "" },
    });

    // 5. احذف الفيديو المحوّل من transcoded/ إذا موجود
    let deletedTranscoded = false;
    if (transcodedPath) {
      const { error } = await supabase.storage.from("uploads").remove([transcodedPath]);
      deletedTranscoded = !error;
    }

    return NextResponse.json({
      deletedFiles,
      deletedTranscoded,
      normalFramesCount: normalFrames.length,
    });

  } catch (err: any) {
    console.error("[video/cleanup]", err);
    return NextResponse.json({ error: err.message ?? "Cleanup failed" }, { status: 500 });
  }
}
