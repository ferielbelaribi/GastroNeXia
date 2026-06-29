import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get("doctorId");
  if (!doctorId)
    return NextResponse.json({ error: "doctorId required" }, { status: 400 });

  const patients = await prisma.patient.findMany({
    where: { doctorId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ patients });
}

export async function POST(req: NextRequest) {
  const { doctorId, firstName, lastName, dateOfBirth, gender, phone, email, condition, notes } =
    await req.json();

  if (!doctorId || !firstName || !lastName || !dateOfBirth)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const patient = await prisma.patient.create({
    data: { doctorId, firstName, lastName, dateOfBirth, gender, phone, email, condition, notes },
  });

  return NextResponse.json({ patient }, { status: 201 });
}