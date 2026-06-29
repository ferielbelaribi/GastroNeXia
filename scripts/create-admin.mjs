/**
 * One-time script — creates the GastroNeXia admin account.
 * Run with:  node scripts/create-admin.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ── Load .env manually ────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* ignore */ }

// ── CJS requires ─────────────────────────────────────────────────────────────
const { PrismaClient }  = require("@prisma/client");
const { PrismaPg }      = require("@prisma/adapter-pg");
const { Pool }          = require("pg");
const bcrypt            = require("bcryptjs");

// ── Config ────────────────────────────────────────────────────────────────────
const EMAIL    = "gastronexia@gmail.com";
const PASSWORD = "GastroNeXia2026";
const FIRST    = "GastroNeXia";
const LAST     = "Admin";
const PHONE    = "";

// ── DB setup ──────────────────────────────────────────────────────────────────
const connectionString = (process.env.DATABASE_URL ?? "").replace(
  /\.pooler\.supabase\.com:5432/,
  ".pooler.supabase.com:6543"
);

const pool   = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const existing = await prisma.admin.findUnique({ where: { email: EMAIL } });

  if (existing) {
    console.log("⚠️  Admin already exists:", existing.email);
    console.log("   Updating password and phone…");
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.admin.update({
      where: { email: EMAIL },
      data:  { passwordHash, phone: PHONE, firstName: FIRST, lastName: LAST },
    });
    console.log("✅ Admin updated successfully.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.admin.create({
    data: { firstName: FIRST, lastName: LAST, email: EMAIL, passwordHash, phone: PHONE },
  });

  console.log("✅ Admin created successfully!");
  console.log("   ID:   ", admin.id);
  console.log("   Email:", admin.email);
  console.log("   Name: ", admin.firstName, admin.lastName);
  console.log("   Phone:", admin.phone);
}

main()
  .catch(e => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
