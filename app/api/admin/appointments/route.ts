import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — list all appointments (admin) or by doctorId
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");

  const appointments = await prisma.appointment.findMany({
    where: doctorId ? { doctorId } : {},
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      doctor:  { select: { id: true, firstName: true, lastName: true, specialty: true, hospital: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ appointments });
}

// PATCH — update appointment status (confirm / cancel)
export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();

  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  const allowed = ["pending", "confirmed", "cancelled", "completed"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data:  { status },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, doctorId: true } },
      doctor:  { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const ops: Promise<unknown>[] = [];

  // Always notify the patient
  ops.push(
    prisma.notification.create({
      data: {
        targetRole: "patient",
        targetId:   appointment.patientId,
        type:       `appointment_${status}`,
        title:      status === "confirmed" ? "Appointment confirmed ✓" : "Appointment update",
        message:    status === "confirmed"
          ? `Your appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${appointment.scheduledDate} at ${appointment.timeSlot} has been confirmed.`
          : `Your appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${appointment.scheduledDate} has been ${status}.`,
        metadata: JSON.stringify({ appointmentId: id }),
      },
    })
  );

  // When confirmed: assign patient to doctor + notify doctor
  if (status === "confirmed") {
    // Assign the patient to this doctor if not already assigned
    if (appointment.patient.doctorId !== appointment.doctorId) {
      ops.push(
        prisma.patient.update({
          where: { id: appointment.patientId },
          data:  { doctorId: appointment.doctorId },
        })
      );
    }

    ops.push(
      prisma.notification.create({
        data: {
          targetRole: "doctor",
          targetId:   appointment.doctorId,
          type:       "new_patient",
          title:      "New patient assigned",
          message:    `${appointment.patient.firstName} ${appointment.patient.lastName} has been assigned to you following a confirmed appointment on ${appointment.scheduledDate} at ${appointment.timeSlot}.`,
          metadata:   JSON.stringify({ appointmentId: id, patientId: appointment.patientId }),
        },
      })
    );
  }

  await Promise.all(ops);

  return NextResponse.json({ appointment });
}
