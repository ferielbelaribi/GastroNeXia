import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAppointmentRequestAlert } from "@/lib/email";

// GET — list this patient's appointments
export async function GET(req: NextRequest) {
  const patientId = req.headers.get("x-patient-id");
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appointments = await prisma.appointment.findMany({
    where: { patientId },
    include: {
      doctor: {
        select: { id: true, firstName: true, lastName: true, specialty: true, hospital: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ appointments });
}

// POST — book a new appointment
export async function POST(req: NextRequest) {
  const patientId = req.headers.get("x-patient-id");
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { doctorId, scheduledDate, timeSlot, reason, notes } = await req.json();

  if (!doctorId || !scheduledDate || !timeSlot || !reason) {
    return NextResponse.json({ error: "doctorId, scheduledDate, timeSlot and reason are required" }, { status: 400 });
  }

  // Only allow booking within the next 7 days
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 7);
  const picked  = new Date(scheduledDate);
  if (picked < today) {
    return NextResponse.json({ error: "You cannot book an appointment in the past." }, { status: 400 });
  }
  if (picked > maxDate) {
    return NextResponse.json({ error: "Appointments can only be booked up to 7 days in advance." }, { status: 400 });
  }

  const [patient, doctor] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.doctor.findUnique({ where: { id: doctorId } }),
  ]);

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (!doctor)  return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const appointment = await prisma.appointment.create({
    data: { patientId, doctorId, scheduledDate, timeSlot, reason, notes: notes ?? "" },
    include: {
      doctor: {
        select: { id: true, firstName: true, lastName: true, specialty: true, hospital: true },
      },
    },
  });

  // Notify all admins (in-app + email)
  const admins = await prisma.admin.findMany({ select: { id: true, email: true, firstName: true, lastName: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map(a => ({
        targetRole: "admin",
        targetId:   a.id,
        type:       "appointment_request",
        title:      "New appointment request",
        message:    `${patient.firstName} ${patient.lastName} requested an appointment with Dr. ${doctor.firstName} ${doctor.lastName} on ${scheduledDate} at ${timeSlot}.`,
        metadata:   JSON.stringify({ appointmentId: appointment.id, patientId, doctorId }),
      })),
    });

    // Email alert — fire-and-forget
    Promise.allSettled(
      admins.map(a => sendAppointmentRequestAlert(a.email, `${a.firstName} ${a.lastName}`, {
        patientName:     `${patient.firstName} ${patient.lastName}`,
        patientEmail:    patient.email,
        patientPhone:    patient.phone,
        doctorName:      `${doctor.firstName} ${doctor.lastName}`,
        doctorSpecialty: doctor.specialty,
        doctorHospital:  doctor.hospital,
        scheduledDate,
        timeSlot,
        reason,
        appointmentId:   appointment.id,
      }))
    ).catch(() => {});
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
