// app/api/visits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const doctorId  = req.nextUrl.searchParams.get("doctorId");
    const patientId = req.nextUrl.searchParams.get("patientId");

    const where: any = {};
    if (doctorId)  where.doctorId  = doctorId;
    if (patientId) where.patientId = patientId;

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ visits });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, doctorId, visitDate, visitType, notes, status } = body;

    if (!patientId || !doctorId || !visitDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const visit = await prisma.visit.create({
      data: { patientId, doctorId, visitDate, visitType, notes, status },
    });

    return NextResponse.json({ visit }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}