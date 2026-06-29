import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

const OTP_INTERVAL_DAYS = 15;

/** Returns true if the user verified OTP within the last 15 days. */
function isRecentlyVerified(lastOtpVerifiedAt: Date | null): boolean {
  if (!lastOtpVerifiedAt) return false;
  const ms = OTP_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastOtpVerifiedAt).getTime() < ms;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // ── 1. Admin ─────────────────────────────────────────────────
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin) {
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    // Verified within last 15 days → skip OTP
    if (isRecentlyVerified(admin.lastOtpVerifiedAt ?? null)) {
      return NextResponse.json({
        doctor: {
          id: admin.id, firstName: admin.firstName, lastName: admin.lastName,
          email: admin.email, hospital: "", specialty: "", phone: admin.phone ?? "",
          avatarUrl: admin.avatarUrl ?? null, role: "admin", createdAt: admin.createdAt,
        },
      });
    }

    const { code, expiresAt } = generateOtp();
    await prisma.admin.update({ where: { id: admin.id }, data: { otpCode: code, otpExpiresAt: expiresAt } });
    await sendOtpEmail(admin.email, `${admin.firstName} ${admin.lastName}`, code);

    const res = NextResponse.json({ requires2FA: true, sentTo: { email: maskEmail(admin.email) } });
    res.cookies.set("_2fa_pending", `${admin.id}|admin`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
    res.cookies.delete("_pending_reg");
    return res;
  }

  // ── 2. Doctor ────────────────────────────────────────────────
  const doctor = await prisma.doctor.findUnique({ where: { email } });
  if (doctor) {
    const valid = await bcrypt.compare(password, doctor.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    // Verified within last 15 days → skip OTP
    if (isRecentlyVerified(doctor.lastOtpVerifiedAt ?? null)) {
      return NextResponse.json({
        doctor: {
          id: doctor.id, firstName: doctor.firstName, lastName: doctor.lastName,
          email: doctor.email, hospital: doctor.hospital, specialty: doctor.specialty,
          phone: doctor.phone, avatarUrl: doctor.avatarUrl ?? null, role: "doctor", createdAt: doctor.createdAt,
        },
      });
    }

    const { code, expiresAt } = generateOtp();
    await prisma.doctor.update({ where: { id: doctor.id }, data: { otpCode: code, otpExpiresAt: expiresAt } });
    await sendOtpEmail(doctor.email, `${doctor.firstName} ${doctor.lastName}`, code);

    const res = NextResponse.json({ requires2FA: true, sentTo: { email: maskEmail(doctor.email) } });
    res.cookies.set("_2fa_pending", `${doctor.id}|doctor`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
    res.cookies.delete("_pending_reg");
    return res;
  }

  // ── 3. Patient ───────────────────────────────────────────────
  const patient = await prisma.patient.findFirst({ where: { email, passwordHash: { not: null } } });
  if (!patient || !patient.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const validPatient = await bcrypt.compare(password, patient.passwordHash);
  if (!validPatient) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  // Verified within last 15 days → skip OTP
  if (isRecentlyVerified(patient.lastOtpVerifiedAt ?? null)) {
    return NextResponse.json({
      doctor: {
        id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
        email: patient.email, phone: patient.phone, avatarUrl: null, role: "patient", createdAt: patient.createdAt,
      },
    });
  }

  const { code: pCode, expiresAt: pExp } = generateOtp();
  await prisma.patient.update({ where: { id: patient.id }, data: { otpCode: pCode, otpExpiresAt: pExp } });
  await sendOtpEmail(patient.email, `${patient.firstName} ${patient.lastName}`, pCode);

  const res = NextResponse.json({ requires2FA: true, sentTo: { email: maskEmail(patient.email) } });
  res.cookies.set("_2fa_pending", `${patient.id}|patient`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  res.cookies.delete("_pending_reg");
  return res;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}
