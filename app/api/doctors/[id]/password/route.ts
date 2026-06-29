import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing doctor ID" }, { status: 400 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Minimum 8 characters" },
        { status: 400 }
      );
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, doctor.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.doctor.update({
      where: { id },
      data: { passwordHash: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[PATCH /api/doctors/:id/password]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}