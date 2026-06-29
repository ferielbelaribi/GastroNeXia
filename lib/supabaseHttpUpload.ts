/**
 * lib/supabaseHttpUpload.ts
 *
 * Upload a Buffer to Supabase Storage using Node.js's built-in https.request()
 * instead of the Supabase JS client.
 *
 * Why: The Supabase JS client uses undici (Node's native fetch) whose
 * connect.timeout is hardcoded to 10 seconds and cannot be overridden via
 * AbortController. Node's https.request() uses a different TCP stack where
 * socket timeouts are fully configurable.
 */

import https from "https";
import http  from "http";
import { URL } from "url";

interface UploadOptions {
  contentType:  string;
  upsert?:      boolean;
  /** Total timeout in ms — default 8 minutes */
  timeoutMs?:   number;
  /** Number of retries on failure — default 3 */
  maxAttempts?: number;
}

/**
 * Upload `data` to Supabase Storage bucket `bucket` at path `storagePath`.
 * Returns the public URL on success, throws on failure.
 */
export async function supabaseHttpUpload(
  bucket:      string,
  storagePath: string,
  data:        Buffer,
  opts:        UploadOptions
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const {
    contentType,
    upsert      = true,
    timeoutMs   = 480_000,   // 8 minutes
    maxAttempts = 3,
  } = opts;

  const uploadUrl = new URL(
    `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`
  );

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await rawUpload(uploadUrl, anonKey, data, contentType, upsert, timeoutMs);
      // success — return public URL
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    } catch (err: any) {
      lastErr = err;
      console.warn(
        `[supabaseHttpUpload] attempt ${attempt}/${maxAttempts} failed:`,
        err?.message ?? err
      );
      if (attempt < maxAttempts) {
        // exponential back-off: 5 s, 10 s
        await sleep(attempt * 5_000);
      }
    }
  }

  throw lastErr;
}

// ── internal helpers ──────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function rawUpload(
  url:         URL,
  anonKey:     string,
  data:        Buffer,
  contentType: string,
  upsert:      boolean,
  timeoutMs:   number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port:     url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname + (url.search || ""),
      method:   "POST",
      headers: {
        "Authorization":  `Bearer ${anonKey}`,
        "Content-Type":   contentType,
        "Content-Length": String(data.length),
        "x-upsert":       upsert ? "true" : "false",
        "cache-control":  "3600",
      } as Record<string, string>,
    };

    const req = (lib as typeof https).request(options, (res) => {
      // drain the response body (required to free the socket)
      const chunks: Buffer[] = [];
      res.on("data",  (c: Buffer) => chunks.push(c));
      res.on("end",   () => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          resolve();
        } else {
          const body = Buffer.concat(chunks).toString("utf8").slice(0, 300);
          reject(new Error(`Supabase storage upload failed: HTTP ${status} — ${body}`));
        }
      });
      res.on("error", reject);
    });

    // ── socket-level timeout (affects TCP connect + all I/O) ────────────────
    req.on("socket", (socket) => {
      socket.setTimeout(timeoutMs);
      socket.on("timeout", () => {
        req.destroy(new Error(`Upload socket timeout after ${timeoutMs}ms`));
      });
    });

    // ── request-level timeout (belt-and-suspenders) ──────────────────────────
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Upload request timeout after ${timeoutMs}ms`));
    });

    req.on("error", reject);

    req.write(data);
    req.end();
  });
}
