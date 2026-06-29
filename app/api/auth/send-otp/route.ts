// Resend a fresh OTP via email.
// Handles both: registration verification (_pending_reg) and login 2FA (_2fa_pending).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: NextRequest) {

  // ── FLOW A: Registration resend (_pending_reg cookie) ─────────
  const pendingCookie = req.cookies.get("_pending_reg")?.value;
  if (pendingCookie) {
    let pending: {
      firstName: string; lastName: string; email: string; passwordHash: string;
      hospital: string; specialty: string; phone: string;
      otpCode: string; otpExpiresAt: string;
    };

    try {
      pending = JSON.parse(Buffer.from(pendingCookie, "base64").toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Invalid session. Please register again." }, { status: 400 });
    }

    const { code, expiresAt } = generateOtp();
    pending.otpCode      = code;
    pending.otpExpiresAt = expiresAt.toISOString();

    await sendOtpEmail(pending.email, `${pending.firstName} ${pending.lastName}`, code);

    const newCookieValue = Buffer.from(JSON.stringify(pending)).toString("base64");
    const res = NextResponse.json({ ok: true });
    res.cookies.set("_pending_reg", newCookieValue, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
    });
    return res;
  }

  // ── FLOW B: Login 2FA resend (_2fa_pending cookie) ────────────
  const loginCookie = req.cookies.get("_2fa_pending")?.value;
  if (!loginCookie) {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
  }

  const [id, role] = loginCookie.split("|");
  if (!id || !role) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { code, expiresAt } = generateOtp();

  if (role === "admin") {
    const admin = await prisma.admin.update({
      where: { id },
      data:  { otpCode: code, otpExpiresAt: expiresAt },
    });
    await sendOtpEmail(admin.email, `${admin.firstName} ${admin.lastName}`, code);
  } else {
    const doctor = await prisma.doctor.update({
      where: { id },
      data:  { otpCode: code, otpExpiresAt: expiresAt },
    });
    await sendOtpEmail(doctor.email, `${doctor.firstName} ${doctor.lastName}`, code);
  }

  return NextResponse.json({ ok: true });
}
