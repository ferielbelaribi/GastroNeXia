import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — get patient profile
export async function GET(req: NextRequest) {
  const patientId = req.headers.get("x-patient-id");
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, dateOfBirth: true, gender: true, condition: true,
      notes: true, status: true, createdAt: true,
    },
  });

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  return NextResponse.json({ patient });
}

// PATCH — update patient profile
export async function PATCH(req: NextRequest) {
  const patientId = req.headers.get("x-patient-id");
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { firstName, lastName, phone, dateOfBirth, gender, condition, notes } = await req.json();

  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...(firstName   !== undefined && { firstName }),
      ...(lastName    !== undefined && { lastName }),
      ...(phone       !== undefined && { phone }),
      ...(dateOfBirth !== undefined && { dateOfBirth }),
      ...(gender      !== undefined && { gender }),
      ...(condition   !== undefined && { condition }),
      ...(notes       !== undefined && { notes }),
    },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, dateOfBirth: true, gender: true, condition: true,
      notes: true, status: true,
    },
  });

  return NextResponse.json({ patient });
}
