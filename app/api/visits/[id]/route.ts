import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseStorage as supabase } from "@/lib/supabase";

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

async function deleteStoragePaths(paths: string[]) {
  const valid = paths.filter(Boolean);
  for (let i = 0; i < valid.length; i += 100) {
    await supabase.storage.from("uploads").remove(valid.slice(i, i + 100));
  }
}

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        media: true,
        analysisResults: {
          include: { detectedLesions: true },
        },
      },
    });

    if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    return NextResponse.json({ visit });
  } catch (e: any) {
    console.error("Visit GET error:", e?.message ?? e);
    return NextResponse.json({ error: "Server error", detail: e?.message }, { status: 500 });
  }
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Collect all storage paths to delete
    const storagePaths: string[] = [];

    const mediaList = await prisma.visitMedia.findMany({
      where: { visitId: id },
      select: {
        id: true,
        storageUrl: true,
        annotatedUrl: true,
        gradcamUrl: true,
        overlayUrl: true,
      },
    });

    for (const media of mediaList) {
      // Collect media-level file paths
      for (const url of [media.storageUrl, media.annotatedUrl, media.gradcamUrl, media.overlayUrl]) {
        if (url) {
          const p = urlToStoragePath(url);
          if (p) storagePaths.push(p);
        }
      }

      // Collect frame file paths
      const frames = await prisma.videoFrame.findMany({
        where: { mediaId: media.id },
        select: { id: true, frameUrl: true },
      });
      const frameIds = frames.map((f: { id: string }) => f.id);
      for (const f of frames) {
        if (f.frameUrl) {
          const p = urlToStoragePath(f.frameUrl);
          if (p) storagePaths.push(p);
        }
      }

      if (frameIds.length > 0) {
        await Promise.all([
          prisma.frameDetection.deleteMany({ where: { frameId: { in: frameIds } } }),
          prisma.detectionFrame.deleteMany({ where: { frameId: { in: frameIds } } }),
          prisma.reportSelectedFrame.deleteMany({ where: { frameId: { in: frameIds } } }),
        ]);
        await prisma.videoFrame.deleteMany({ where: { id: { in: frameIds } } });
      }
    }

    // Clean up analyses
    const analyses = await prisma.analysisResult.findMany({
      where: { visitId: id },
      select: { id: true },
    });
    const analysisIds = analyses.map((a: { id: string }) => a.id);
    if (analysisIds.length > 0) {
      await prisma.report.deleteMany({ where: { analysisId: { in: analysisIds } } });
      await prisma.detectedLesion.deleteMany({ where: { analysisId: { in: analysisIds } } });
      await prisma.analysisResult.deleteMany({ where: { id: { in: analysisIds } } });
    }

    await prisma.visitMedia.deleteMany({ where: { visitId: id } });
    await prisma.visit.delete({ where: { id } });

    // Delete all files from Supabase storage (fire-and-forget errors — DB is already clean)
    await deleteStoragePaths(storagePaths);

    return NextResponse.json({ message: "Deleted" });
  } catch (e: any) {
    if (e?.code === "P2025") return NextResponse.json({ message: "Deleted" });
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await req.json();
    const visit = await prisma.visit.update({ where: { id }, data });
    return NextResponse.json({ visit });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", detail: e?.message }, { status: 500 });
  }
}