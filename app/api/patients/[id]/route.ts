import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;
export const dynamic     = "force-dynamic";

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ patient });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", detail: e?.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await req.json();
    const patient = await prisma.patient.update({ where: { id }, data });
    return NextResponse.json({ patient });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", detail: e?.message }, { status: 500 });
  }
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const visits = await prisma.visit.findMany({ where: { patientId: id }, select: { id: true } });
    const visitIds = visits.map(v => v.id);

    if (visitIds.length > 0) {
      // parallel: fetch media AND all analyses by visitId
      const [medias, analyses] = await Promise.all([
        prisma.visitMedia.findMany({ where: { visitId: { in: visitIds } }, select: { id: true } }),
        prisma.analysisResult.findMany({ where: { visitId: { in: visitIds } }, select: { id: true } }),
      ]);
      const mediaIds   = medias.map(m => m.id);
      const analysisIds = analyses.map(a => a.id);

      if (mediaIds.length > 0) {
        const frames = await prisma.videoFrame.findMany({ where: { mediaId: { in: mediaIds } }, select: { id: true } });
        const frameIds = frames.map(f => f.id);

        if (frameIds.length > 0) {
          // parallel delete of all frame-level children
          await Promise.all([
            prisma.frameDetection.deleteMany({ where: { frameId: { in: frameIds } } }),
            prisma.detectionFrame.deleteMany({ where: { frameId: { in: frameIds } } }),
            prisma.reportSelectedFrame.deleteMany({ where: { frameId: { in: frameIds } } }),
          ]);
          await prisma.videoFrame.deleteMany({ where: { id: { in: frameIds } } });
        }

        await prisma.visitMedia.deleteMany({ where: { id: { in: mediaIds } } });
      }

      if (analysisIds.length > 0) {
        await Promise.all([
          prisma.report.deleteMany({ where: { analysisId: { in: analysisIds } } }),
          prisma.detectedLesion.deleteMany({ where: { analysisId: { in: analysisIds } } }),
        ]);
        await prisma.analysisResult.deleteMany({ where: { id: { in: analysisIds } } });
      }

      await prisma.report.deleteMany({ where: { visitId: { in: visitIds } } });
      await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
    }

    await prisma.report.deleteMany({ where: { patientId: id } });
    await prisma.patient.delete({ where: { id } });

    return NextResponse.json({ message: "Deleted" });
  } catch (e: any) {
    // P2025 = record not found — patient was already deleted (previous timed-out request succeeded)
    if (e?.code === "P2025") return NextResponse.json({ message: "Deleted" });
    const detail = e?.message ?? e?.meta?.cause ?? JSON.stringify(e);
    console.error("DELETE patient error:", detail);
    return NextResponse.json({ error: "Server error", detail }, { status: 500 });
  }
}