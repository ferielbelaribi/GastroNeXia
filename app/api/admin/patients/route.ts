// app/api/admin/patients/route.ts
// List ALL patients across all doctors (admin only)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url       = new URL(req.url);
    const doctorId  = url.searchParams.get("doctorId");
    const search    = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status    = url.searchParams.get("status");

    const where: any = {};
    if (doctorId)        where.doctorId = doctorId;
    if (status && status !== "all") where.status = status;

    const patients = await prisma.patient.findMany({
      where,
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, hospital: true, specialty: true } },
        _count: { select: { visits: true, reports: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = search
      ? patients.filter(p =>
          `${p.firstName} ${p.lastName} ${p.email} ${p.condition} ${p.doctor?.firstName ?? ""} ${p.doctor?.lastName ?? ""}`
            .toLowerCase().includes(search))
      : patients;

    return NextResponse.json({ patients: filtered });
  } catch (err: any) {
    console.error("[admin/patients GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
