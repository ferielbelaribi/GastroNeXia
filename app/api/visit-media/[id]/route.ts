import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Delete child records first
    const frames = await prisma.videoFrame.findMany({ where: { mediaId: id }, select: { id: true } });
    const frameIds = frames.map(f => f.id);
    if (frameIds.length > 0) {
      await Promise.all([
        prisma.frameDetection.deleteMany({ where: { frameId: { in: frameIds } } }),
        prisma.detectionFrame.deleteMany({ where: { frameId: { in: frameIds } } }),
        prisma.reportSelectedFrame.deleteMany({ where: { frameId: { in: frameIds } } }),
      ]);
      await prisma.videoFrame.deleteMany({ where: { id: { in: frameIds } } });
    }

    await prisma.visitMedia.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (e: any) {
    if (e?.code === "P2025") return NextResponse.json({ message: "Deleted" });
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
