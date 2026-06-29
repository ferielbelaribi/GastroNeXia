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

/** Check that the email domain actually has mail servers (MX records).
 *  Fails OPEN — if the DNS lookup errors for any reason (network, env, timeout)
 *  we let the request through; the OTP delivery will catch truly dead addresses. */
async function emailDomainHasMx(email: string): Promise<boolean> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    // DNS unavailable or timed out → assume valid, don't block the user
    return true;
  }
}

export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password, hospital, specialty, phone } =
    await req.json();

  if (!firstName || !lastName || !email || !password || !hospital || !phone) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // ── 1. Basic email format check ───────────────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // ── 2. MX record check — does this domain actually receive email? ──
  const domainValid = await emailDomainHasMx(email);
  if (!domainValid) {
    const domain = email.split("@")[1] ?? "";
    return NextResponse.json(
      { error: `The domain "${domain}" does not appear to be a valid email provider. Please check your email address.` },
      { status: 400 }
    );
  }

  // ── 3. Check if email already exists (doctor OR admin) ────────
  const existingDoctor = await prisma.doctor.findUnique({ where: { email } });
  const existingAdmin  = await prisma.admin.findUnique({ where: { email } });
  if (existingDoctor || existingAdmin) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please sign in instead." },
      { status: 400 }
    );
  }

  // ── 4. Hash password ──────────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, 10);

  // ── 5. Generate OTP and send ──────────────────────────────────
  const { code, expiresAt } = generateOtp();
  try {
    await sendOtpEmail(email, `${firstName} ${lastName}`, code);
  } catch {
    return NextResponse.json(
      { error: "Could not send verification email. Please check the address and try again." },
      { status: 400 }
    );
  }

  // ── 6. Store pending registration in cookie (account NOT created yet) ──
  const pending = {
    firstName, lastName, email, passwordHash, hospital,
    specialty: specialty ?? "Gastroenterology", phone,
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
