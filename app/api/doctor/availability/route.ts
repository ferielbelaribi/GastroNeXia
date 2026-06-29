import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — fetch availability for a doctor
export async function GET(req: NextRequest) {
  const doctorId = new URL(req.url).searchParams.get("doctorId");
  if (!doctorId) return NextResponse.json({ error: "doctorId required" }, { status: 400 });

  const availability = await prisma.doctorAvailability.findMany({
    where: { doctorId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ availability });
}

// PUT — upsert full weekly schedule for a doctor
// Body: { doctorId, days: [{ dayOfWeek, startTime, endTime, slotMinutes, isActive }] }
export async function PUT(req: NextRequest) {
  const { doctorId, days } = await req.json();

  if (!doctorId || !Array.isArray(days)) {
    return NextResponse.json({ error: "doctorId and days[] are required" }, { status: 400 });
  }

  // Upsert each day (replace all existing for this doctor)
  await prisma.doctorAvailability.deleteMany({ where: { doctorId } });

  const records = await prisma.doctorAvailability.createMany({
    data: days.map((d: {
      dayOfWeek: number; startTime: string; endTime: string;
      slotMinutes?: number; isActive?: boolean;
    }) => ({
      doctorId,
      dayOfWeek:   d.dayOfWeek,
      startTime:   d.startTime,
      endTime:     d.endTime,
      slotMinutes: d.slotMinutes ?? 30,
      isActive:    d.isActive ?? true,
    })),
  });

  return NextResponse.json({ count: records.count });
}
