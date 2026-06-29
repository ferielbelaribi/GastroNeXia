// app/api/admin/doctors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET — list all doctors (with basic stats)
export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      select: {
        id: true, firstName: true, lastName: true,
        email: true, hospital: true, specialty: true,
        phone: true, createdAt: true,
        _count: {
          select: { patients: true, analysisResults: true, reports: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ doctors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a new doctor (by admin)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, password, hospital, specialty, phone } = body;

    if (!firstName || !lastName || !email || !password || !hospital || !specialty || !phone) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const existing = await prisma.doctor.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const doctor = await prisma.doctor.create({
      data: { firstName, lastName, email, passwordHash, hospital, specialty, phone },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, hospital: true, specialty: true,
        phone: true, createdAt: true,
      },
    });

    return NextResponse.json({ doctor }, { status: 201 });
  } catch (err: any) {
    console.error("[admin/doctors POST]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
