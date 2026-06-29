import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";
import { promises as dns } from "dns";

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

async function emailDomainHasMx(email: string): Promise<boolean> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password, phone, dateOfBirth, gender } =
    await req.json();

  if (!firstName || !lastName || !email || !password || !phone) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const domainValid = await emailDomainHasMx(email);
  if (!domainValid) {
    const domain = email.split("@")[1] ?? "";
    return NextResponse.json(
      { error: `The domain "${domain}" does not appear to be a valid email provider.` },
      { status: 400 }
    );
  }

  // Check across all user tables
  const existingDoctor  = await prisma.doctor.findUnique({ where: { email } });
  const existingAdmin   = await prisma.admin.findUnique({ where: { email } });
  const existingPatient = await prisma.patient.findFirst({
    where: { email, passwordHash: { not: null } },
  });

  if (existingDoctor || existingAdmin || existingPatient) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please sign in instead." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { code, expiresAt } = generateOtp();

  try {
    await sendOtpEmail(email, `${firstName} ${lastName}`, code);
  } catch {
    return NextResponse.json(
      { error: "Could not send verification email. Please check the address and try again." },
      { status: 400 }
    );
  }

  const pending = {
    registrationRole: "patient",
    firstName, lastName, email, passwordHash, phone,
    dateOfBirth: dateOfBirth ?? "",
    gender: gender ?? "",
    otpCode: code,
    otpExpiresAt: expiresAt.toISOString(),
  };
  const cookieValue = Buffer.from(JSON.stringify(pending)).toString("base64");

  const res = NextResponse.json(
    { requiresVerification: true, sentTo: { email: maskEmail(email) } },
    { status: 200 }
  );
  res.cookies.set("_pending_reg", cookieValue, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  res.cookies.delete("_2fa_pending");
  return res;
}
