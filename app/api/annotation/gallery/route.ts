import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";

export async function GET() {
  try {
    // ── List images from Supabase Storage ──────────────────────────────────
    const [imgRes, maskRes] = await Promise.all([
      supabaseAdmin.storage.from(BUCKET).list("manual/images", { limit: 1000, sortBy: { column: "created_at", order: "desc" } }),
      supabaseAdmin.storage.from(BUCKET).list("manual/masks",  { limit: 1000 }),
    ]);

    const imageFiles = (imgRes.data ?? [])
      .filter(f => f.name !== ".emptyFolderPlaceholder" && /\.(jpg|jpeg|png|bmp)$/i.test(f.name));

    const maskSet = new Set(
      (maskRes.data ?? [])
        .filter(f => f.name !== ".emptyFolderPlaceholder")
        .map(f => f.name)
    );

    // ── Annotation counts from local JSON (best-effort) ────────────────────
    let annotationMap: Record<string, number> = {};
    try {
      const jsonPath = path.join(process.cwd(), "annotation_output", "manual", "annotations.json");
      const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
      for (const entry of json.images ?? []) {
        annotationMap[entry.filename] = (entry.annotations ?? []).length;
      }
    } catch {}

    const items = imageFiles.map(f => {
      const baseName     = path.parse(f.name).name;
      const maskFilename = maskSet.has(`${baseName}.png`) ? `${baseName}.png` : null;
      return {
        filename:        f.name,
        maskFilename,
        annotationCount: annotationMap[f.name] ?? 0,
      };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
