import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Convert "HH:MM" to total minutes
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Convert total minutes to "HH:MM"
function toTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Generate all slots between startTime and endTime with slotMinutes duration
function generateSlots(startTime: string, endTime: string, slotMinutes: number): string[] {
  const slots: string[] = [];
  let cur = toMinutes(startTime);
  const end = toMinutes(endTime);
  while (cur + slotMinutes <= end) {
    slots.push(`${toTime(cur)}–${toTime(cur + slotMinutes)}`);
    cur += slotMinutes;
  }
  return slots;
}

// GET — available slots for a doctor on a given date
// Query: doctorId, date (YYYY-MM-DD)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const date     = searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json({ error: "doctorId and date required" }, { status: 400 });
  }

  // Day of week from the date string (0=Sun … 6=Sat)
  const dayOfWeek = new Date(date + "T12:00:00").getDay();

  // Doctor's availability for that day
  const avail = await prisma.doctorAvailability.findFirst({
    where: { doctorId, dayOfWeek, isActive: true },
  });

  if (!avail) {
    return NextResponse.json({ slots: [], reason: "Doctor unavailable on this day" });
  }

  const allSlots = generateSlots(avail.startTime, avail.endTime, avail.slotMinutes);

  // Appointments already booked for this doctor on this date (pending or confirmed)
  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledDate: date,
      status: { in: ["pending", "confirmed"] },
    },
    select: { timeSlot: true },
  });

  const bookedSet = new Set(booked.map(a => a.timeSlot));
  const available = allSlots.filter(s => !bookedSet.has(s));

  return NextResponse.json({ slots: available, allSlots, bookedSlots: [...bookedSet] });
}
