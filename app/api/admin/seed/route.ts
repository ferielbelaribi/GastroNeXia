// TEMPORARY — delete this file after first use
export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const existing = await prisma.admin.findUnique({ where: { email: "admin@gastroneXia.dz" } });
    if (existing) {
      return NextResponse.json({ ok: true, message: "Admin already exists", id: existing.id });
    }

    const admin = await prisma.admin.create({
      data: {
        firstName:    "ramzi",
        lastName:     "bouramoul",
        email:        "admin@gastroneXia.dz",
        passwordHash: await bcrypt.hash("admin123", 10),
      },
    });

    return NextResponse.json({ ok: true, message: "Admin created", id: admin.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
