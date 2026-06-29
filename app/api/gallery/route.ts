import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get("doctorId");
  if (!doctorId)
    return NextResponse.json({ error: "doctorId required" }, { status: 400 });

  try {
    const visits = await prisma.visit.findMany({
      where: { doctorId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, gender: true },
        },
        media: {
          select: {
            id: true,
            mediaType: true,
            filename: true,
            totalFrames: true,
            storageUrl: true,
            overlayUrl: true,
            captureSource: true,
            uploadedAt: true,
            frames: {
              orderBy: { frameIndex: "asc" },
              select: {
                id: true,
                frameIndex: true,
                frameUrl: true,
                timestampSeconds: true,
                hasDetection: true,
                overallRisk: true,
                frameDetections: {
                  select: {
                    id: true,
                    label: true,
                    confidence: true,
                    severity: true,
                    boundingBox: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { visitDate: "desc" },
    });

    return NextResponse.json({ visits });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
