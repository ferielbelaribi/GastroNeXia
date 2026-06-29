// app/api/admin/doctors/[id]/details/route.ts
// Full profile of one doctor: their patients, recent visits, analyses, reports
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        hospital: true, specialty: true, phone: true, createdAt: true,
        _count: { select: { patients: true, visits: true, analysisResults: true, reports: true } },
      },
    });
    if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [patients, recentAnalyses, recentReports, riskCounts] = await Promise.all([
      prisma.patient.findMany({
        where: { doctorId: id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { visits: true, reports: true } } },
      }),
      prisma.analysisResult.findMany({
        where: { doctorId: id },
        orderBy: { analyzedAt: "desc" }, take: 20,
        include: {
          visit: { include: { patient: { select: { firstName: true, lastName: true } } } },
          reports: { select: { id: true } },
        },
      }),
      prisma.report.findMany({
        where: { doctorId: id },
        orderBy: { createdAt: "desc" }, take: 20,
        include: { patient: { select: { firstName: true, lastName: true } } },
      }),
      prisma.analysisResult.groupBy({
        where: { doctorId: id },
        by: ["overallRisk"], _count: { id: true },
      }),
    ]);

    const riskMap: Record<string, number> = {};
    riskCounts.forEach(r => { riskMap[r.overallRisk] = r._count.id; });

    return NextResponse.json({
      doctor,
      patients,
      recentAnalyses: recentAnalyses.map(a => ({
        id: a.id,
        shortId: a.id.slice(0, 8).toUpperCase(),
        patient: a.visit?.patient ? `${a.visit.patient.firstName} ${a.visit.patient.lastName}` : "Unknown",
        analysisType: a.analysisType,
        risk: a.overallRisk,
        confidence: Math.round(a.overallConfidence),
        analyzedAt: a.analyzedAt,
        hasReport: a.reports.length > 0,
      })),
      recentReports: recentReports.map(r => ({
        id: r.id, title: r.title, status: r.status,
        patient: `${r.patient.firstName} ${r.patient.lastName}`,
        createdAt: r.createdAt, pdfUrl: r.pdfUrl,
      })),
      riskMap,
    });
  } catch (err: any) {
    console.error("[admin/doctors/[id]/details GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
