import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function PUT(req: NextRequest) {
  const { id, firstName, lastName, email, phone, bio } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Doctor ID is required" }, { status: 400 });
  }

  const doctor = await prisma.doctor.update({
    where: { id },
    data: { firstName, lastName, email, phone, specialty: bio },
  });

  return NextResponse.json({ message: "Updated successfully", doctor });
}
