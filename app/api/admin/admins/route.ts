export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET — list all admins
export async function GET() {
  const admins = await prisma.admin.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ admins });
}

// POST — create a new admin account
export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password, phone } = await req.json();

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: "firstName, lastName, email and password are required" }, { status: 400 });
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An admin with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: { firstName, lastName, email, passwordHash, phone: phone ?? "" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, createdAt: true },
  });

  return NextResponse.json({ admin }, { status: 201 });
}

// DELETE — remove an admin account
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await prisma.admin.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
