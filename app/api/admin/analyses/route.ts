// app/api/admin/analyses/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url      = new URL(req.url);
    const doctorId = url.searchParams.get("doctorId");
    const risk     = url.searchParams.get("risk");
    const type     = url.searchParams.get("type");
    const search   = url.searchParams.get("search")?.toLowerCase() ?? "";
    const limit    = Number(url.searchParams.get("limit") ?? "200");

    const where: any = {};
    if (doctorId) where.doctorId = doctorId;
    if (risk && risk !== "all") where.overallRisk  = risk;
    if (type && type !== "all") where.analysisType = type;

    const analyses = await prisma.analysisResult.findMany({
      where,
      orderBy: { analyzedAt: "desc" },
      take: limit,
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        visit:  { include: { patient: { select: { id: true, firstName: true, lastName: true } } } },
        detectedLesions: { select: { lesionType: true, severity: true, confidence: true }, take: 3 },
        reports: { select: { id: true, title: true, pdfUrl: true } },
      },
    });

    const items = analyses.map((a: any) => ({
      id:           a.id,
      shortId:      a.id.slice(0, 8).toUpperCase(),
      doctor:       `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
      doctorId:     a.doctor.id,
      patient:      a.visit?.patient ? `${a.visit.patient.firstName} ${a.visit.patient.lastName}` : "Unknown",
      patientId:    a.visit?.patient?.id,
      analysisType: a.analysisType,
      risk:         a.overallRisk,
      confidence:   Math.round(a.overallConfidence),
      status:       a.status,
      framesAnalyzed:    a.totalFramesAnalyzed,
      framesWithDetection: a.framesWithDetection,
      lesions:      a.detectedLesions,
      hasReport:    a.reports.length > 0,
      reportId:     a.reports[0]?.id ?? null,
      analyzedAt:   a.analyzedAt,
    }));

    const filtered = search
      ? items.filter(i => `${i.doctor} ${i.patient} ${i.shortId} ${i.analysisType}`.toLowerCase().includes(search))
      : items;

    return NextResponse.json({ analyses: filtered });
  } catch (err: any) {
    console.error("[admin/analyses GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
