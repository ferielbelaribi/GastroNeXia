import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { sendNewPatientAlert } from "@/lib/email";
import crypto from "crypto";

const DEVICE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function newDeviceToken() {
  return crypto.randomBytes(32).toString("hex");
}

function setDeviceCookie(res: NextResponse, userId: string, role: string, token: string) {
  res.cookies.set("_trusted_device", `${userId}|${role}|${token}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE,
  });
}

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
  }

  // ══════════════════════════════════════════════════════════════
  // FLOW A — Login 2FA (_2fa_pending) — checked FIRST
  // ══════════════════════════════════════════════════════════════
  const loginCookie = req.cookies.get("_2fa_pending")?.value;
  if (loginCookie) {
    const [id, role] = loginCookie.split("|");
    if (!id || !role) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    // ── Admin ──────────────────────────────────────────────────
    if (role === "admin") {
      const admin = await prisma.admin.findUnique({ where: { id } });
      if (!admin) return NextResponse.json({ error: "Account not found." }, { status: 404 });

      if (!verifyOtp({ code: admin.otpCode, expiresAt: admin.otpExpiresAt }, code)) {
        return NextResponse.json({ error: "Invalid or expired code. Please try again." }, { status: 401 });
      }

      const deviceToken = newDeviceToken();
      await prisma.admin.update({ where: { id }, data: { otpCode: null, otpExpiresAt: null, trustedDeviceToken: deviceToken, lastOtpVerifiedAt: new Date() } });

      const res = NextResponse.json({
        message: "Verified",
        doctor: {
          id: admin.id, firstName: admin.firstName, lastName: admin.lastName,
          email: admin.email, hospital: "", specialty: "", phone: admin.phone ?? "",
          avatarUrl: admin.avatarUrl ?? null, role: "admin", createdAt: admin.createdAt,
        },
      });
      res.cookies.delete("_2fa_pending");
      res.cookies.delete("_pending_reg");
      setDeviceCookie(res, admin.id, "admin", deviceToken);
      return res;
    }

    // ── Doctor ─────────────────────────────────────────────────
    if (role === "doctor") {
      const doctor = await prisma.doctor.findUnique({ where: { id } });
      if (!doctor) return NextResponse.json({ error: "Account not found." }, { status: 404 });

      if (!verifyOtp({ code: doctor.otpCode, expiresAt: doctor.otpExpiresAt }, code)) {
        return NextResponse.json({ error: "Invalid or expired code. Please try again." }, { status: 401 });
      }

      const deviceToken = newDeviceToken();
      await prisma.doctor.update({ where: { id }, data: { otpCode: null, otpExpiresAt: null, trustedDeviceToken: deviceToken, lastOtpVerifiedAt: new Date() } });

      const res = NextResponse.json({
        message: "Verified",
        doctor: {
          id: doctor.id, firstName: doctor.firstName, lastName: doctor.lastName,
          email: doctor.email, hospital: doctor.hospital, specialty: doctor.specialty,
          phone: doctor.phone, avatarUrl: doctor.avatarUrl ?? null, role: "doctor", createdAt: doctor.createdAt,
        },
      });
      res.cookies.delete("_2fa_pending");
      res.cookies.delete("_pending_reg");
      setDeviceCookie(res, doctor.id, "doctor", deviceToken);
      return res;
    }

    // ── Patient ────────────────────────────────────────────────
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    if (!verifyOtp({ code: patient.otpCode, expiresAt: patient.otpExpiresAt }, code)) {
      return NextResponse.json({ error: "Invalid or expired code. Please try again." }, { status: 401 });
    }

    const patDeviceToken = newDeviceToken();
    await prisma.patient.update({ where: { id }, data: { otpCode: null, otpExpiresAt: null, trustedDeviceToken: patDeviceToken, lastOtpVerifiedAt: new Date() } });

    const patRes = NextResponse.json({
      message: "Verified",
      doctor: {
        id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
        email: patient.email, phone: patient.phone, avatarUrl: null, role: "patient", createdAt: patient.createdAt,
      },
    });
    patRes.cookies.delete("_2fa_pending");
    patRes.cookies.delete("_pending_reg");
    setDeviceCookie(patRes, patient.id, "patient", patDeviceToken);
    return patRes;
  }

  // ══════════════════════════════════════════════════════════════
  // FLOW B — Registration verification (_pending_reg) — checked SECOND
  // Account has NOT been created yet — verify first, then create.
  // ══════════════════════════════════════════════════════════════
  const pendingCookie = req.cookies.get("_pending_reg")?.value;
  if (pendingCookie) {
    let pending: {
      registrationRole?: string;
      firstName: string; lastName: string; email: string; passwordHash: string;
      hospital?: string; specialty?: string; phone: string;
      dateOfBirth?: string; gender?: string;
      otpCode: string; otpExpiresAt: string;
    };

    try {
      pending = JSON.parse(Buffer.from(pendingCookie, "base64").toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Invalid session. Please register again." }, { status: 400 });
    }

    if (!verifyOtp({ code: pending.otpCode, expiresAt: new Date(pending.otpExpiresAt) }, code)) {
      return NextResponse.json({ error: "Invalid or expired code. Please try again." }, { status: 401 });
    }

    // ── Patient registration ───────────────────────────────────
    if (pending.registrationRole === "patient") {
      const existingPatient = await prisma.patient.findFirst({
        where: { email: pending.email, passwordHash: { not: null } },
      });
      if (existingPatient) {
        const r = NextResponse.json(
          { error: "This email is already registered. Please sign in instead." },
          { status: 409 }
        );
        r.cookies.delete("_pending_reg");
        return r;
      }

      const newPatient = await prisma.patient.create({
        data: {
          firstName:    pending.firstName,
          lastName:     pending.lastName,
          email:        pending.email,
          passwordHash: pending.passwordHash,
          phone:        pending.phone,
          dateOfBirth:  pending.dateOfBirth ?? "",
          gender:       pending.gender ?? "",
        },
      });

      // Notify all admins by email (fire-and-forget)
      prisma.admin.findMany({ select: { email: true, firstName: true, lastName: true } })
        .then(admins => Promise.allSettled(
          admins.map(a => sendNewPatientAlert(
            a.email,
            `${a.firstName} ${a.lastName}`,
            { firstName: newPatient.firstName, lastName: newPatient.lastName, email: newPatient.email, phone: newPatient.phone },
          ))
        ))
        .catch(() => {/* silent — don't block the response */});

      const r = NextResponse.json({
        message: "Account created and verified",
        doctor: {
          id:        newPatient.id,
          firstName: newPatient.firstName,
          lastName:  newPatient.lastName,
          email:     newPatient.email,
          phone:     newPatient.phone,
          avatarUrl: null,
          role:      "patient",
          createdAt: newPatient.createdAt,
        },
      });
      r.cookies.delete("_pending_reg");
      return r;
    }

    // ── Doctor registration (default) ─────────────────────────
    const existing = await prisma.doctor.findUnique({ where: { email: pending.email } });
    if (existing) {
      const res = NextResponse.json(
        { error: "This email was registered by someone else. Please use a different email." },
        { status: 409 }
      );
      res.cookies.delete("_pending_reg");
      return res;
    }

    const doctor = await prisma.doctor.create({
      data: {
        firstName:    pending.firstName,
        lastName:     pending.lastName,
        email:        pending.email,
        passwordHash: pending.passwordHash,
        hospital:     pending.hospital ?? "",
        specialty:    pending.specialty ?? "Gastroenterology",
        phone:        pending.phone,
      },
    });

    const res = NextResponse.json({
      message: "Account created and verified",
      doctor: {
        id:        doctor.id,
        firstName: doctor.firstName,
        lastName:  doctor.lastName,
        email:     doctor.email,
        hospital:  doctor.hospital,
        specialty: doctor.specialty,
        phone:     doctor.phone,
        avatarUrl: null,
        role:      "doctor",
        createdAt: doctor.createdAt,
      },
    });
    res.cookies.delete("_pending_reg");
    return res;
  }

  // ══════════════════════════════════════════════════════════════
  // No valid session cookie found
  // ══════════════════════════════════════════════════════════════
  return NextResponse.json(
    { error: "Session expired. Please log in again." },
    { status: 401 }
  );
}
