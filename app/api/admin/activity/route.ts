// app/api/admin/activity/route.ts
export const dynamic = 'force-dynamic'
// Unified activity feed across the platform
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url   = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");

    const [analyses, reports, patients, visits] = await Promise.all([
      prisma.analysisResult.findMany({
        orderBy: { analyzedAt: "desc" }, take: limit,
        include: {
          doctor: { select: { firstName: true, lastName: true } },
          visit:  { include: { patient: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        include: {
          doctor:  { select: { firstName: true, lastName: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.patient.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        include: { doctor: { select: { firstName: true, lastName: true } } },
      }),
      prisma.visit.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        include: {
          doctor:  { select: { firstName: true, lastName: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    type Item = {
      id: string; kind: "analysis" | "report" | "patient" | "visit";
      title: string; subtitle: string; meta: string; date: string;
      risk?: string;
    };

    const events: Item[] = [
      ...analyses.map(a => ({
        id: `a-${a.id}`, kind: "analysis" as const,
        title: `New analysis · ${a.analysisType}`,
        subtitle: `Dr. ${a.doctor.firstName} ${a.doctor.lastName} → ${a.visit?.patient ? `${a.visit.patient.firstName} ${a.visit.patient.lastName}` : "Unknown"}`,
        meta: `Risk: ${a.overallRisk} · ${Math.round(a.overallConfidence)}% confidence`,
        date: a.analyzedAt.toISOString(),
        risk: a.overallRisk,
      })),
      ...reports.map(r => ({
        id: `r-${r.id}`, kind: "report" as const,
        title: `Report ${r.status}`,
        subtitle: `Dr. ${r.doctor.firstName} ${r.doctor.lastName} → ${r.patient.firstName} ${r.patient.lastName}`,
        meta: r.title,
        date: r.createdAt.toISOString(),
      })),
      ...patients.map(p => ({
        id: `p-${p.id}`, kind: "patient" as const,
        title: "Patient registered",
        subtitle: p.doctor ? `Dr. ${p.doctor.firstName} ${p.doctor.lastName}` : "Unassigned",
        meta: `${p.firstName} ${p.lastName}`,
        date: p.createdAt.toISOString(),
      })),
      ...visits.map(v => ({
        id: `v-${v.id}`, kind: "visit" as const,
        title: `Visit · ${v.visitType}`,
        subtitle: `Dr. ${v.doctor.firstName} ${v.doctor.lastName} → ${v.patient.firstName} ${v.patient.lastName}`,
        meta: `${v.visitDate} · ${v.status}`,
        date: v.createdAt.toISOString(),
      })),
    ];

    events.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ events: events.slice(0, limit) });
  } catch (err: any) {
    console.error("[admin/activity GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
