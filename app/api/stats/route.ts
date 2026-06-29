import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [doctors, patients, reports, visits] = await Promise.all([
      prisma.doctor.count(),
      prisma.patient.count(),
      prisma.report.count(),
      prisma.visit.count(),
    ]);

    return NextResponse.json({ doctors, patients, reports, visits });
  } catch {
    return NextResponse.json({ doctors: 0, patients: 0, reports: 0, visits: 0 });
  }
}
