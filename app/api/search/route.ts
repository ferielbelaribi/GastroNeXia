// app/api/search/route.ts — Global cross-entity search
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url      = new URL(req.url);
    const q        = (url.searchParams.get("q") ?? "").trim();
    const scope    = (url.searchParams.get("scope") ?? "doctor") as "doctor" | "admin";
    const doctorId = url.searchParams.get("doctorId") ?? "";

    if (!q || q.length < 2) {
      return NextResponse.json({ patients: [], reports: [], analyses: [], doctors: [], visits: [] });
    }

    const isAdmin    = scope === "admin";
    const doctorWhere = isAdmin ? {} : { doctorId };
    const limit      = 6;

    // Patients ─ name / email / condition
    const patients = await prisma.patient.findMany({
      where: {
        ...doctorWhere,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName:  { contains: q, mode: "insensitive" } },
          { email:     { contains: q, mode: "insensitive" } },
          { condition: { contains: q, mode: "insensitive" } },
          { phone:     { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, firstName: true, lastName: true, condition: true, status: true,
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    // Reports ─ title / conclusion
    const reports = await prisma.report.findMany({
      where: {
        ...doctorWhere,
        OR: [
          { title:      { contains: q, mode: "insensitive" } },
          { conclusion: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, title: true, status: true, createdAt: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor:  { select: { id: true, firstName: true, lastName: true } },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Analyses ─ id prefix or risk
    const isUuidLike = /^[0-9a-f-]{4,}$/i.test(q);
    const analyses = await prisma.analysisResult.findMany({
      where: {
        ...doctorWhere,
        OR: [
          ...(isUuidLike ? [{ id: { startsWith: q.toLowerCase() } }] : []),
          { overallRisk: { equals: q.toLowerCase() } },
          { analysisType: { contains: q, mode: "insensitive" as const } },
        ],
      },
      select: {
        id: true, analysisType: true, overallRisk: true, overallConfidence: true,
        analyzedAt: true,
        visit: { include: { patient: { select: { id: true, firstName: true, lastName: true } } } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
      take: limit,
      orderBy: { analyzedAt: "desc" },
    });

    // Visits ─ visitType / notes
    const visits = await prisma.visit.findMany({
      where: {
        ...doctorWhere,
        OR: [
          { visitType: { contains: q, mode: "insensitive" } },
          { notes:     { contains: q, mode: "insensitive" } },
          { status:    { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, visitDate: true, visitType: true, status: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor:  { select: { id: true, firstName: true, lastName: true } },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Doctors ─ admin only
    const doctors = isAdmin
      ? await prisma.doctor.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName:  { contains: q, mode: "insensitive" } },
              { email:     { contains: q, mode: "insensitive" } },
              { hospital:  { contains: q, mode: "insensitive" } },
              { specialty: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true, specialty: true, hospital: true },
          take: limit,
          orderBy: { createdAt: "desc" },
        })
      : [];

    return NextResponse.json({
      patients: patients.map(p => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        condition: p.condition,
        status: p.status,
        doctor: p.doctor ? `Dr. ${p.doctor.firstName} ${p.doctor.lastName}` : "Unassigned",
        doctorId: p.doctor?.id ?? null,
      })),
      reports: reports.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status,
        date: r.createdAt,
        patient: `${r.patient.firstName} ${r.patient.lastName}`,
        patientId: r.patient.id,
        doctor: `Dr. ${r.doctor.firstName} ${r.doctor.lastName}`,
        doctorId: r.doctor.id,
      })),
      analyses: analyses.map(a => ({
        id: a.id,
        shortId: a.id.slice(0, 8).toUpperCase(),
        type: a.analysisType,
        risk: a.overallRisk,
        confidence: Math.round(a.overallConfidence),
        date: a.analyzedAt,
        patient: a.visit?.patient ? `${a.visit.patient.firstName} ${a.visit.patient.lastName}` : "Unknown",
        patientId: a.visit?.patient?.id,
        doctor: `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
        doctorId: a.doctor.id,
      })),
      visits: visits.map(v => ({
        id: v.id,
        type: v.visitType,
        status: v.status,
        date: v.visitDate,
        patient: `${v.patient.firstName} ${v.patient.lastName}`,
        patientId: v.patient.id,
        doctor: `Dr. ${v.doctor.firstName} ${v.doctor.lastName}`,
        doctorId: v.doctor.id,
      })),
      doctors: doctors.map(d => ({
        id: d.id,
        name: `Dr. ${d.firstName} ${d.lastName}`,
        email: d.email,
        specialty: d.specialty,
        hospital: d.hospital,
      })),
    });
  } catch (err: any) {
    console.error("[/api/search]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
