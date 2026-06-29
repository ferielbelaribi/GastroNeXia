/** Generate a cryptographically-random 6-digit OTP and its expiry (10 min). */
export function generateOtp(): { code: string; expiresAt: Date } {
  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, expiresAt };
}

/** Returns true if the stored code matches and has not expired. */
export function verifyOtp(
  stored: { code: string | null; expiresAt: Date | null },
  input: string
): boolean {
  if (!stored.code || !stored.expiresAt) return false;
  if (new Date() > stored.expiresAt) return false;
  return stored.code === input.trim();
}
