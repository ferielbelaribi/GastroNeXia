import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const patientId = searchParams.get("patientId");
    const visitId   = searchParams.get("visitId");
    const doctorId  = searchParams.get("doctorId");

    const analyses = await prisma.analysisResult.findMany({
      where: {
        ...(patientId ? { visit: { patientId } } : {}),
        ...(visitId   ? { visitId }               : {}),
        ...(doctorId  ? { doctorId }              : {}),
      },
      include: { detectedLesions: true },
      orderBy: { analyzedAt: "desc" },
    });

    return NextResponse.json({ analyses });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      visitId,
      mediaId,
      doctorId,
      analysisType,
      modelVersion,
      overallConfidence,
      overallRisk,
      framesWithDetection,
      status,
      rawOutput,
      detectedLesions,
    } = body;

    if (!visitId)  return NextResponse.json({ error: "visitId is required" },  { status: 400 });
    if (!doctorId) return NextResponse.json({ error: "doctorId is required" }, { status: 400 });

    let resolvedMediaId: string | undefined = mediaId ?? undefined;

const analysisData: any = {
  visitId,
  doctorId,
  analysisType:        analysisType        ?? "detection",
  overallRisk:         overallRisk         ?? "low",
  modelVersion:        modelVersion        ?? "Unknown",
  overallConfidence:   overallConfidence   ?? 0,
  framesWithDetection: framesWithDetection ?? 0,
  status:              status              ?? "completed",
  rawOutput:           rawOutput           ?? "",
  detectedLesions: {
    create: (detectedLesions ?? []).map((l: any) => ({
      lesionType:     l.lesionType     ?? "Unknown",
      classification: l.classification ?? "",
      confidence:     Number(l.confidence ?? 0),
      severity:       l.severity       ?? "low",
      location:       l.location       ?? "",
      boundingBox:    l.boundingBox    ?? "",
    })),
  },
};

// ربط mediaId فقط إذا موجود
if (mediaId) analysisData.mediaId = mediaId;

    const analysis = await prisma.analysisResult.create({
      data: {
        visitId,
        mediaId:             resolvedMediaId,
        doctorId,
        analysisType:        analysisType        ?? "detection",
        overallRisk:         overallRisk         ?? "low",
        modelVersion:        modelVersion        ?? "Unknown",
        overallConfidence:   overallConfidence   ?? 0,
        framesWithDetection: framesWithDetection ?? 0,
        status:              status              ?? "completed",
        rawOutput:           rawOutput           ?? "",
        detectedLesions: {
          create: (detectedLesions ?? []).map((l: any) => ({
            lesionType:     l.lesionType     ?? "Unknown",
            classification: l.classification ?? "",
            confidence:     Number(l.confidence ?? 0),
            severity:       l.severity       ?? "low",
            location:       l.location       ?? "",
            boundingBox:    l.boundingBox    ?? "",
          })),
        },
      },
      include: { detectedLesions: true },
    });

    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error: any) {
    console.error("[/api/analysis POST]", error);
    return NextResponse.json({ error: error.message ?? "Server error" }, { status: 500 });
  }
}


