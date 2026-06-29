import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — list all doctors (for patient to choose when booking)
export async function GET(_req: NextRequest) {
  const doctors = await prisma.doctor.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialty: true,
      hospital: true,
      avatarUrl: true,
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json({ doctors });
}
