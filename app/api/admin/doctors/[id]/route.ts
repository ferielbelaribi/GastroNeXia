// app/api/admin/doctors/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// PATCH — edit a doctor
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { firstName, lastName, email, hospital, specialty, phone, password } = body;

    const data: Record<string, any> = {};
    if (firstName)  data.firstName  = firstName;
    if (lastName)   data.lastName   = lastName;
    if (email)      data.email      = email;
    if (hospital)   data.hospital   = hospital;
    if (specialty)  data.specialty  = specialty;
    if (phone)      data.phone      = phone;
    if (password)   data.passwordHash = await bcrypt.hash(password, 10);

    const doctor = await prisma.doctor.update({
      where: { id },
      data,
      select: {
        id: true, firstName: true, lastName: true,
        email: true, hospital: true, specialty: true,
        phone: true, createdAt: true,
      },
    });

    return NextResponse.json({ doctor });
  } catch (err: any) {
    console.error("[admin/doctors PATCH]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove a doctor and all their data (cascade)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.doctor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[admin/doctors DELETE]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
