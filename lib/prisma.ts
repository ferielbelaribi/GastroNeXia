import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// Use Transaction-mode pooler (port 6543) to avoid session-mode connection limits.
// Fall back to DATABASE_URL as-is if the env var is already on 6543.
const connectionString = (process.env.DATABASE_URL ?? "").replace(
  /\.pooler\.supabase\.com:5432/,
  ".pooler.supabase.com:6543"
);

declare global {
  // eslint-disable-next-line no-var
  var __prismaPool:   Pool         | undefined;
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

// Singleton pool — survives Next.js hot reloads in dev
const pool: Pool =
  globalThis.__prismaPool ??
  new Pool({
    connectionString,
    ssl:                     { rejectUnauthorized: false },
    max:                     3,
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaPool = pool;
}

const adapter = new PrismaPg(pool);

// Singleton client
export const prisma: PrismaClient =
  globalThis.__prismaClient ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}
