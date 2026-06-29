import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;

    const visits = await prisma.visit.findMany({
      where: { patientId },
      include: {
        analysisResults: {
          include: { detectedLesions: true },
          orderBy: { analyzedAt: "asc" },
        },
      },
      orderBy: { visitDate: "asc" },
    });

    // Flat chronological list of analyses (oldest first)
    const allAnalyses = visits.flatMap(v =>
      v.analysisResults.map(a => ({ ...a, visitType: v.visitType, visitDate: v.visitDate }))
    );
    const allLesions = allAnalyses.flatMap(a =>
      a.detectedLesions.map(l => ({
        ...l,
        analysisDate: a.analyzedAt,
        analysisRisk: a.overallRisk,
        visitType: a.visitType,
      }))
    );

    // Visit type breakdown
    const visitTypeBreakdown: Record<string, number> = {};
    for (const v of visits) {
      visitTypeBreakdown[v.visitType] = (visitTypeBreakdown[v.visitType] ?? 0) + 1;
    }

    // Risk distribution
    const riskDist = { high: 0, moderate: 0, low: 0 };
    for (const a of allAnalyses) {
      if (a.overallRisk === "high") riskDist.high++;
      else if (a.overallRisk === "moderate") riskDist.moderate++;
      else riskDist.low++;
    }

    // Lesion evolution — group by type, chronological
    const byType: Record<string, typeof allLesions> = {};
    for (const l of allLesions) {
      const key = l.lesionType || "Unknown";
      if (!byType[key]) byType[key] = [];
      byType[key].push(l);
    }
    const lesionEvolution = Object.entries(byType)
      .map(([type, entries]) => {
        const first = entries[0];
        const last  = entries[entries.length - 1];
        const riskScore = (r: string) => r === "high" ? 2 : r === "moderate" ? 1 : 0;
        const scoreDiff = riskScore(last.analysisRisk) - riskScore(first.analysisRisk);
        return {
          type,
          occurrences:   entries.length,
          firstDate:     first.analysisDate,
          lastDate:      last.analysisDate,
          firstSeverity: first.severity,
          lastSeverity:  last.severity,
          firstRisk:     first.analysisRisk,
          lastRisk:      last.analysisRisk,
          firstConf:     Math.round(first.confidence),
          lastConf:      Math.round(last.confidence),
          trend:         scoreDiff > 0 ? "worsening" : scoreDiff < 0 ? "improving" : "stable",
        };
      })
      .sort((a, b) => b.occurrences - a.occurrences);

    // Overall risk trend
    const riskScore = (r: string) => r === "high" ? 2 : r === "moderate" ? 1 : 0;
    const recent   = allAnalyses.slice(-3);
    const previous = allAnalyses.slice(-6, -3);
    const recentAvg   = recent.length   ? recent.reduce((s, a)   => s + riskScore(a.overallRisk), 0) / recent.length   : null;
    const previousAvg = previous.length ? previous.reduce((s, a) => s + riskScore(a.overallRisk), 0) / previous.length : null;
    let overallTrend: "improving" | "worsening" | "stable" | "insufficient" = "insufficient";
    if (recentAvg !== null && previousAvg !== null) {
      if      (recentAvg < previousAvg - 0.15) overallTrend = "improving";
      else if (recentAvg > previousAvg + 0.15) overallTrend = "worsening";
      else                                      overallTrend = "stable";
    }

    // Risk progression timeline (chronological, for dots)
    const riskProgression = allAnalyses.map(a => ({
      date:      a.analyzedAt,
      risk:      a.overallRisk,
      visitType: a.visitType,
      conf:      Math.round(a.overallConfidence),
    }));

    // Last 5 visits (most recent first) for visit list
    const recentVisits = [...visits].reverse().slice(0, 5).map(v => ({
      id:            v.id,
      visitDate:     v.visitDate,
      visitType:     v.visitType,
      status:        v.status,
      risk:          v.analysisResults[v.analysisResults.length - 1]?.overallRisk ?? null,
      analysisCount: v.analysisResults.length,
      findings:      [...new Set(
        v.analysisResults.flatMap(a => a.detectedLesions.map(l => l.lesionType))
      )],
    }));

    const avgConfidence = allAnalyses.length
      ? Math.round(allAnalyses.reduce((s, a) => s + a.overallConfidence, 0) / allAnalyses.length)
      : 0;

    return NextResponse.json({
      totalVisits:       visits.length,
      totalAnalyses:     allAnalyses.length,
      totalLesions:      allLesions.length,
      avgConfidence,
      firstVisitDate:    visits[0]?.visitDate ?? null,
      lastVisitDate:     visits[visits.length - 1]?.visitDate ?? null,
      visitTypeBreakdown,
      riskDist,
      lesionEvolution,
      overallTrend,
      riskProgression,
      recentVisits,
      lastAnalysisRisk:  allAnalyses[allAnalyses.length - 1]?.overallRisk ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
