// app/api/admin/patients/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — full patient profile (visits, reports, analyses)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        doctor:  { select: { id: true, firstName: true, lastName: true, email: true, hospital: true, specialty: true } },
        visits:  {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { media: true, analysisResults: true, reports: true } },
          },
        },
        reports: {
          orderBy: { createdAt: "desc" },
          select:  { id: true, title: true, status: true, createdAt: true, pdfUrl: true, conclusion: true },
        },
      },
    });
    if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ patient });
  } catch (err: any) {
    console.error("[admin/patients/[id] GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — admin can remove any patient (cascade)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.patient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[admin/patients/[id] DELETE]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — admin can update patient status / notes / reassign doctor
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id }   = await context.params;
    const body     = await req.json();
    const allowed  = ["firstName", "lastName", "phone", "email", "condition", "notes", "status", "doctorId"];
    const data: Record<string, any> = {};
    for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

    const patient = await prisma.patient.update({ where: { id }, data });
    return NextResponse.json({ patient });
  } catch (err: any) {
    console.error("[admin/patients/[id] PATCH]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
