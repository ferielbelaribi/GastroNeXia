// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function PATCH(
//   req: NextRequest,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { id } = await params;

//     if (!id) {
//       return NextResponse.json({ error: "Missing doctor ID" }, { status: 400 });
//     }

//     const body = await req.json();
//     const { firstName, lastName, email, specialty, phone, hospital } = body;

//     const updated = await prisma.doctor.update({
//       where: { id },
//       data: {
//         ...(firstName !== undefined && { firstName }),
//         ...(lastName  !== undefined && { lastName  }),
//         ...(email     !== undefined && { email     }),
//         ...(specialty !== undefined && { specialty }),
//         ...(phone     !== undefined && { phone     }),
//         ...(hospital  !== undefined && { hospital  }),
//       },
//       select: {
//         id:        true,
//         firstName: true,
//         lastName:  true,
//         email:     true,
//         specialty: true,
//         phone:     true,
//         hospital:  true,
//         createdAt: true,
//         updatedAt: true,
//       },
//     });

//     return NextResponse.json({ doctor: updated });
//   } catch (err: unknown) {
//     console.error("[PATCH /api/doctors/:id]", err);
//     if (
//       err instanceof Error &&
//       err.message.includes("Unique constraint")
//     ) {
//       return NextResponse.json(
//         { error: "Email already in use" },
//         { status: 409 }
//       );
//     }
//     return NextResponse.json({ error: "Failed to update" }, { status: 500 });
//   }
// }

// export async function DELETE(
//   req: NextRequest,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { id } = await params;

//     if (!id) {
//       return NextResponse.json({ error: "Missing doctor ID" }, { status: 400 });
//     }

//     await prisma.doctor.delete({ where: { id } });
//     return NextResponse.json({ success: true });
//   } catch (err: unknown) {
//     console.error("[DELETE /api/doctors/:id]", err);
//     return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const { firstName, lastName, email, specialty, phone, hospital } = body;

    // Try Doctor first; admins also use this endpoint, so fall back if not found
    const existsDoctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });

    if (existsDoctor) {
      const updated = await prisma.doctor.update({
        where: { id },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName  !== undefined && { lastName  }),
          ...(email     !== undefined && { email     }),
          ...(specialty !== undefined && { specialty }),
          ...(phone     !== undefined && { phone     }),
          ...(hospital  !== undefined && { hospital  }),
        },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          specialty: true, phone: true, hospital: true, avatarUrl: true,
          createdAt: true, updatedAt: true,
        },
      });
      return NextResponse.json({ doctor: updated });
    }

    const existsAdmin = await prisma.admin.findUnique({ where: { id }, select: { id: true } });
    if (existsAdmin) {
      const updated = await prisma.admin.update({
        where: { id },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName  !== undefined && { lastName  }),
          ...(email     !== undefined && { email     }),
          ...(phone     !== undefined && { phone     }),
        },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, avatarUrl: true, createdAt: true, updatedAt: true,
        },
      });
      return NextResponse.json({
        doctor: { ...updated, specialty: "", hospital: "", role: "admin" },
      });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (err: unknown) {
    console.error("[PATCH /api/doctors/:id]", err);
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing doctor ID" }, { status: 400 });
    }

    await prisma.doctor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/doctors/:id]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}