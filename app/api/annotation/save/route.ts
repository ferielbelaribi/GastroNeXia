import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { supabaseAdmin, BUCKET, ensureBucket } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      filename: string;
      originalBase64: string;
      maskBase64: string;
      annotations: unknown[];
    };

    const { filename, originalBase64, maskBase64, annotations } = body;
    if (!filename || !originalBase64 || !maskBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const baseName  = path.parse(filename).name;
    const ext       = path.parse(filename).ext || ".jpg";
    const baseDir   = path.join(process.cwd(), "annotation_output", "manual");
    const imagesDir = path.join(baseDir, "images");
    const masksDir  = path.join(baseDir, "masks");
    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(masksDir,  { recursive: true });

    // Save original image
    const origData = originalBase64.replace(/^data:image\/\w+;base64,/, "");
    await fs.writeFile(path.join(imagesDir, `${baseName}${ext}`), Buffer.from(origData, "base64"));

    // Save B&W mask — same base name as original, in masks/ folder
    const maskData = maskBase64.replace(/^data:image\/\w+;base64,/, "");
    await fs.writeFile(path.join(masksDir, `${baseName}.png`), Buffer.from(maskData, "base64"));

    // Append/update combined annotations.json
    const jsonPath = path.join(baseDir, "annotations.json");
    let combined: { updated_at: string; images: any[] } = { updated_at: new Date().toISOString(), images: [] };
    try {
      combined = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
    } catch {}

    const entry = {
      filename,
      saved_at: new Date().toISOString(),
      annotations: (annotations as any[]).map((a: any, i: number) => ({
        id:           i + 1,
        label:        a.label,
        color:        a.color,
        segmentation: [a.points.flatMap(([x, y]: [number, number]) => [x, y])],
      })),
    };

    const existingIdx = combined.images.findIndex(img => img.filename === filename);
    if (existingIdx >= 0) {
      combined.images[existingIdx] = entry;
    } else {
      combined.images.push(entry);
    }
    combined.updated_at = new Date().toISOString();

    await fs.writeFile(jsonPath, JSON.stringify(combined, null, 2));

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    await ensureBucket();
    await Promise.all([
      supabaseAdmin.storage.from(BUCKET).upload(
        `manual/images/${baseName}${ext}`,
        Buffer.from(origData, "base64"),
        { upsert: true, contentType: ext === ".png" ? "image/png" : "image/jpeg" }
      ),
      supabaseAdmin.storage.from(BUCKET).upload(
        `manual/masks/${baseName}.png`,
        Buffer.from(maskData, "base64"),
        { upsert: true, contentType: "image/png" }
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[annotation/save]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
