// app/api/admin/reports/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url      = new URL(req.url);
    const doctorId = url.searchParams.get("doctorId");
    const status   = url.searchParams.get("status");
    const search   = url.searchParams.get("search")?.toLowerCase() ?? "";

    const where: any = {};
    if (doctorId) where.doctorId = doctorId;
    if (status && status !== "all") where.status = status;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, status: true, createdAt: true, generatedAt: true,
        pdfUrl: true, conclusion: true, recommendation: true,
        doctor:   { select: { id: true, firstName: true, lastName: true, specialty: true } },
        patient:  { select: { id: true, firstName: true, lastName: true } },
        analysis: { select: { id: true, overallRisk: true, overallConfidence: true, analysisType: true } },
      },
    });

    const filtered = search
      ? reports.filter(r =>
          `${r.title} ${r.doctor.firstName} ${r.doctor.lastName} ${r.patient.firstName} ${r.patient.lastName} ${r.conclusion}`
            .toLowerCase().includes(search))
      : reports;

    return NextResponse.json({ reports: filtered });
  } catch (err: any) {
    console.error("[admin/reports GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
