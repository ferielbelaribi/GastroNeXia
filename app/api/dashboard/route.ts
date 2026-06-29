// // app/api/dashboard/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function GET(req: NextRequest) {
//   try {
//     const doctorId = req.nextUrl.searchParams.get("doctorId");
//     const where    = doctorId ? { doctorId } : {};

//     // ── نجيب كل شيء في parallel ──────────────────────────────────
//     const [
//       totalAnalyses,
//       analysesThisWeek,
//       analysesYesterday,
//       riskCounts,
//       typeCounts,
//       avgConfidence,
//       recentAnalyses,
//       last10Days,
//       last7Days,
//     ] = await Promise.all([

//       // 1. Total analyses
//       prisma.analysisResult.count({ where }),

//       // 2. This week
//       prisma.analysisResult.count({
//         where: {
//           ...where,
//           analyzedAt: { gte: new Date(Date.now() - 7 * 86400000) },
//         },
//       }),

//       // 3. Yesterday
//       prisma.analysisResult.count({
//         where: {
//           ...where,
//           analyzedAt: {
//             gte: new Date(Date.now() - 2 * 86400000),
//             lt:  new Date(Date.now() - 1 * 86400000),
//           },
//         },
//       }),

//       // 4. Risk distribution
//       prisma.analysisResult.groupBy({
//         by:    ["overallRisk"],
//         where,
//         _count: { id: true },
//       }),

//       // 5. Analysis type distribution
//       prisma.analysisResult.groupBy({
//         by:    ["analysisType"],
//         where,
//         _count: { id: true },
//       }),

//       // 6. Average confidence
//       prisma.analysisResult.aggregate({
//         where,
//         _avg: { overallConfidence: true },
//       }),

//       // 7. Recent 8 analyses avec patient info
//       prisma.analysisResult.findMany({
//         where,
//         orderBy: { analyzedAt: "desc" },
//         take:    8,
//         include: {
//           visit: {
//             include: {
//               patient: { select: { firstName: true, lastName: true } },
//             },
//           },
//           detectedLesions: { select: { lesionType: true, severity: true }, take: 1 },
//           media: { select: { storageUrl: true, annotatedUrl: true } },
//         },
//       }),

//       // 8. Last 10 days (one count per day)
//       prisma.$queryRaw<{ day: string; count: bigint }[]>`
//         SELECT
//           DATE("analyzedAt") AS day,
//           COUNT(*) AS count
//         FROM "AnalysisResult"
//         WHERE "analyzedAt" >= NOW() - INTERVAL '10 days'
//         ${doctorId ? prisma.$queryRaw`AND "doctorId" = ${doctorId}` : prisma.$queryRaw``}
//         GROUP BY DATE("analyzedAt")
//         ORDER BY day ASC
//       `.catch(() => []),

//       // 9. Last 7 days per day label
//       prisma.$queryRaw<{ day: string; count: bigint }[]>`
//         SELECT
//           TO_CHAR("analyzedAt", 'Dy') AS day,
//           COUNT(*) AS count
//         FROM "AnalysisResult"
//         WHERE "analyzedAt" >= NOW() - INTERVAL '7 days'
//         ${doctorId ? prisma.$queryRaw`AND "doctorId" = ${doctorId}` : prisma.$queryRaw``}
//         GROUP BY TO_CHAR("analyzedAt", 'Dy'), DATE("analyzedAt")
//         ORDER BY DATE("analyzedAt") ASC
//       `.catch(() => []),
//     ]);

//     // ── Lesion type counts from detectedLesions ───────────────────
//     const lesionCounts = await prisma.detectedLesion.groupBy({
//       by:    ["lesionType"],
//       where: doctorId
//         ? { analysis: { doctorId } }
//         : {},
//       _count: { id: true },
//       orderBy: { _count: { id: "desc" } },
//       take: 5,
//     });

//     // ── Total detected lesions ────────────────────────────────────
//     const totalLesions = await prisma.detectedLesion.count({
//       where: doctorId ? { analysis: { doctorId } } : {},
//     });

//     // ── Build week bar chart data (Mon→Sun) ───────────────────────
//     const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
//     const weekMap: Record<string, number> = {};
//     (last7Days as any[]).forEach((r) => {
//       weekMap[r.day] = Number(r.count);
//     });
//     const weekData = dayLabels.map((d) => weekMap[d] ?? 0);

//     // ── Build trend (last 10 days) ────────────────────────────────
//     const trendData = Array.from({ length: 10 }, (_, i) => {
//       const d = new Date();
//       d.setDate(d.getDate() - (9 - i));
//       const key = d.toISOString().split("T")[0];
//       const found = (last10Days as any[]).find((r) => r.day === key);
//       return found ? Number(found.count) : 0;
//     });

//     // ── Risk distribution ─────────────────────────────────────────
//     const riskMap: Record<string, number> = {};
//     riskCounts.forEach((r) => { riskMap[r.overallRisk] = r._count.id; });

//     // ── Detection type ─────────────────────────────────────────────
//     const typeMap: Record<string, number> = {};
//     typeCounts.forEach((t) => { typeMap[t.analysisType] = t._count.id; });

//     // ── Recent cases for table ────────────────────────────────────
//     const recentCases = recentAnalyses.map((a) => {
//       const patient = a.visit?.patient;
//       const lesion  = a.detectedLesions[0];
//       return {
//         id:         a.id.slice(0, 8).toUpperCase(),
//         analysisId: a.id,
//         visitId:    a.visitId,
//         patient:    patient ? `${patient.firstName} ${patient.lastName}` : "Unknown",
//         type:       lesion?.lesionType ?? (a.analysisType === "detection" ? "CAD Analysis" : "Segmentation"),
//         region:     lesion ? (a.detectedLesions[0] as any).location || "—" : "—",
//         confidence: Math.round(a.overallConfidence),
//         risk:       a.overallRisk,
//         date:       a.analyzedAt.toISOString(),
//         imageUrl:   a.media?.annotatedUrl || a.media?.storageUrl || null,
//         lesionCount: a.detectedLesions.length,
//         analysisType: a.analysisType,
//       };
//     });

//     // ── Stats cards ───────────────────────────────────────────────
//     const highRisk   = riskMap["high"]     ?? 0;
//     const moderateRisk = riskMap["moderate"] ?? riskMap["medium"] ?? 0;
//     const avgConf    = Math.round(avgConfidence._avg.overallConfidence ?? 0);

//     // Lesion distribution for donut
//     const totalLesionCount = lesionCounts.reduce((s, l) => s + l._count.id, 0) || 1;
//     const distData = lesionCounts.slice(0, 4).map((l) => ({
//       label: l.lesionType,
//       count: l._count.id,
//       pct:   Math.round((l._count.id / totalLesionCount) * 100),
//     }));

//     return NextResponse.json({
//       stats: {
//         totalAnalyses,
//         totalLesions,
//         highRisk,
//         moderateRisk,
//         avgConfidence: avgConf,
//         analysesThisWeek,
//         analysesYesterday,
//         detectionCount:    typeMap["detection"]    ?? 0,
//         segmentationCount: typeMap["segmentation"] ?? 0,
//       },
//       charts: {
//         weekData,
//         weekLabels: dayLabels,
//         trendData,
//         distData,
//         riskMap,
//       },
//       recentCases,
//     });
//   } catch (err: any) {
//     console.error("[/api/dashboard]", err);
//     return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
//   }
// }


// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const doctorId = req.nextUrl.searchParams.get("doctorId");
    // Only include analyses whose patient still exists (guards against orphan data)
    const where = {
      ...(doctorId ? { doctorId } : {}),
      visit: { patient: { id: { gt: "" } } },
    };

    // ✅ "This week" = من الاثنين الماضي إلى الآن (أسبوع تقويمي حقيقي)
    const now         = new Date();
    const dayOfWeek   = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysSinceMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysSinceMon);
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      totalAnalyses,
      analysesThisWeek,    // ✅ من الاثنين الحالي
      riskCounts,
      typeCounts,
      avgConfidence,
      recentAnalyses,
      lesionCounts,
      totalLesions,
    ] = await Promise.all([

      prisma.analysisResult.count({ where }),

      // ✅ هاد الأسبوع = من الاثنين إلى الآن
      prisma.analysisResult.count({
        where: { ...where, analyzedAt: { gte: startOfWeek } },
      }),

      prisma.analysisResult.groupBy({
        by: ["overallRisk"], where, _count: { id: true },
      }),

      prisma.analysisResult.groupBy({
        by: ["analysisType"], where, _count: { id: true },
      }),

      prisma.analysisResult.aggregate({
        where, _avg: { overallConfidence: true },
      }),

      // ✅ أضفنا patientId في recentCases
      prisma.analysisResult.findMany({
        where,
        orderBy: { analyzedAt: "desc" },
        take: 8,
        include: {
          visit: {
            include: {
              patient: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          detectedLesions: {
            select: { lesionType: true, severity: true, location: true },
            take: 1,
          },
          reports: { select: { id: true }, take: 1 },
        },
      }),

      prisma.detectedLesion.groupBy({
        by: ["lesionType"],
        where: {
          analysis: {
            ...(doctorId ? { doctorId } : {}),
            visit: { patient: { id: { gt: "" } } },
          },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      prisma.detectedLesion.count({
        where: {
          analysis: {
            ...(doctorId ? { doctorId } : {}),
            visit: { patient: { id: { gt: "" } } },
          },
        },
      }),
    ]);

    // ── Week bar chart (Mon→Sun de la semaine courante) ───────────
    const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekData   = await Promise.all(
      weekLabels.map(async (_, i) => {
        const dayStart = new Date(startOfWeek);
        dayStart.setDate(startOfWeek.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        return prisma.analysisResult.count({
          where: { ...where, analyzedAt: { gte: dayStart, lt: dayEnd } },
        });
      })
    );

    // ── Trend: last 10 calendar days ─────────────────────────────
    const trendData = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const dayStart = new Date(now);
        dayStart.setDate(now.getDate() - (9 - i));
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        return prisma.analysisResult.count({
          where: { ...where, analyzedAt: { gte: dayStart, lt: dayEnd } },
        });
      })
    );

    // ── Risk + type maps ──────────────────────────────────────────
    const riskMap: Record<string, number> = {};
    riskCounts.forEach((r) => { riskMap[r.overallRisk] = r._count.id; });

    const typeMap: Record<string, number> = {};
    typeCounts.forEach((t) => { typeMap[t.analysisType] = t._count.id; });

    // ── Lesion distribution ───────────────────────────────────────
    const totalLesionCount = lesionCounts.reduce((s, l) => s + l._count.id, 0) || 1;
    const distData = lesionCounts.slice(0, 5).map((l) => ({
      label: l.lesionType,
      count: l._count.id,
      pct:   Math.round((l._count.id / totalLesionCount) * 100),
    }));

    // ── Recent cases ─────────────────────────────────────────────
    const recentCases = recentAnalyses.map((a: any) => {
      const patient = a.visit?.patient;
      const lesion  = a.detectedLesions?.[0];
      return {
        id:           a.id.slice(0, 8).toUpperCase(),
        analysisId:   a.id,
        visitId:      a.visitId,
        patientId:    patient?.id ?? "",          // ✅ patientId pour navigation
        reportId:     a.reports?.[0]?.id ?? null,
        patient:      patient ? `${patient.firstName} ${patient.lastName}` : "Unknown",
        type:         lesion?.lesionType ?? (a.analysisType === "detection" ? "No lesion detected" : "Segmentation result"),
        region:       lesion?.location   ?? "—",
        confidence:   Math.round(a.overallConfidence),
        risk:         a.overallRisk,
        date:         a.analyzedAt.toISOString(),
        imageUrl:     null,
        lesionCount:  a.detectedLesions?.length ?? 0,
        analysisType: a.analysisType,
      };
    });

    // ── Stats summary ─────────────────────────────────────────────
    const highRisk     = riskMap["high"]     ?? 0;
    const moderateRisk = riskMap["moderate"] ?? riskMap["medium"] ?? 0;
    const avgConf      = Math.round(avgConfidence._avg.overallConfidence ?? 0);

    return NextResponse.json({
      stats: {
        totalAnalyses,
        totalLesions,
        highRisk,
        moderateRisk,
        avgConfidence:     avgConf,
        analysesThisWeek,
        detectionCount:    typeMap["detection"]    ?? 0,
        segmentationCount: typeMap["segmentation"] ?? 0,
      },
      charts: {
        weekData,
        weekLabels,
        trendData,
        distData,
        riskMap,
      },
      recentCases,
    });

  } catch (err: any) {
    console.error("[/api/dashboard]", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}