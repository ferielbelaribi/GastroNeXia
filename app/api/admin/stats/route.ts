// app/api/admin/stats/route.ts
// Platform-wide statistics for the admin dashboard
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      totalDoctors,
      totalPatients,
      totalVisits,
      totalAnalyses,
      totalReports,
      totalLesions,
      highRiskAnalyses,
      riskCounts,
      typeCounts,
      avgConfidence,
      recentAnalyses,
      doctorsWithStats,
    ] = await Promise.all([
      prisma.doctor.count(),
      prisma.patient.count(),
      prisma.visit.count(),
      prisma.analysisResult.count(),
      prisma.report.count(),
      prisma.detectedLesion.count(),

      prisma.analysisResult.count({ where: { overallRisk: "high" } }),

      prisma.analysisResult.groupBy({
        by: ["overallRisk"], _count: { id: true },
      }),

      prisma.analysisResult.groupBy({
        by: ["analysisType"], _count: { id: true },
      }),

      prisma.analysisResult.aggregate({
        _avg: { overallConfidence: true },
      }),

      // Last 8 analyses across all doctors
      prisma.analysisResult.findMany({
        orderBy: { analyzedAt: "desc" },
        take: 8,
        include: {
          doctor:  { select: { id: true, firstName: true, lastName: true, specialty: true } },
          visit:   { include: { patient: { select: { id: true, firstName: true, lastName: true } } } },
          detectedLesions: { select: { lesionType: true, severity: true }, take: 1 },
          reports: { select: { id: true }, take: 1 },
        },
      }),

      // Per-doctor breakdown
      prisma.doctor.findMany({
        select: {
          id: true, firstName: true, lastName: true,
          email: true, hospital: true, specialty: true, phone: true, createdAt: true,
          _count: {
            select: { patients: true, visits: true, analysisResults: true, reports: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const riskMap: Record<string, number> = {};
    riskCounts.forEach(r => { riskMap[r.overallRisk] = r._count.id; });

    const typeMap: Record<string, number> = {};
    typeCounts.forEach(t => { typeMap[t.analysisType] = t._count.id; });

    const recentActivity = recentAnalyses.map((a: any) => ({
      id:           a.id.slice(0, 8).toUpperCase(),
      analysisId:   a.id,
      doctor:       `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
      doctorId:     a.doctor.id,
      patient:      a.visit?.patient ? `${a.visit.patient.firstName} ${a.visit.patient.lastName}` : "Unknown",
      type:         a.detectedLesions?.[0]?.lesionType ?? (a.analysisType === "detection" ? "CAD Analysis" : a.analysisType === "video" ? "Live Monitoring" : "Segmentation"),
      analysisType: a.analysisType,
      risk:         a.overallRisk,
      confidence:   Math.round(a.overallConfidence),
      date:         a.analyzedAt.toISOString(),
      hasReport:    a.reports.length > 0,
    }));

    return NextResponse.json({
      stats: {
        totalDoctors,
        totalPatients,
        totalVisits,
        totalAnalyses,
        totalReports,
        totalLesions,
        highRiskAnalyses,
        avgConfidence: Math.round(avgConfidence._avg.overallConfidence ?? 0),
        detectionCount:    typeMap["detection"]    ?? 0,
        segmentationCount: typeMap["segmentation"] ?? 0,
        liveCount:         typeMap["video"]        ?? 0,
        riskMap,
      },
      doctors: doctorsWithStats,
      recentActivity,
    });
  } catch (err: any) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
