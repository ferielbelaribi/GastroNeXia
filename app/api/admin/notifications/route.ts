export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — get notifications for a target (admin or doctor)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetId   = searchParams.get("targetId");
  const targetRole = searchParams.get("targetRole");

  if (!targetId || !targetRole) {
    return NextResponse.json({ error: "targetId and targetRole are required" }, { status: 400 });
  }

  const notifications = await prisma.notification.findMany({
    where: { targetId, targetRole },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}

// PATCH — mark notification(s) as read
export async function PATCH(req: NextRequest) {
  const { ids, targetId, targetRole, markAll } = await req.json();

  if (markAll && targetId && targetRole) {
    await prisma.notification.updateMany({
      where: { targetId, targetRole, isRead: false },
      data:  { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: { in: ids } },
    data:  { isRead: true },
  });

  return NextResponse.json({ success: true });
}

// DELETE — clear all notifications for a target
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetId   = searchParams.get("targetId");
  const targetRole = searchParams.get("targetRole");

  if (!targetId || !targetRole) {
    return NextResponse.json({ error: "targetId and targetRole are required" }, { status: 400 });
  }

  await prisma.notification.deleteMany({ where: { targetId, targetRole } });
  return NextResponse.json({ success: true });
}
