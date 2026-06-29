import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs   from "fs/promises";
import { supabaseAdmin, BUCKET, ensureBucket } from "@/lib/supabase-admin";

/**
 * POST /api/annotation/save-esophagitis
 * Body: { filename: string, imageBase64: string, maskBase64: string }
 *
 * Saves the original image and binary mask to disk without re-running inference.
 * annotation_output/esophagitis/images/{name}{ext}
 * annotation_output/esophagitis/masks/{name}.png
 */
export async function POST(req: NextRequest) {
  try {
    const { filename, imageBase64, maskBase64, doctorRating } = await req.json() as {
      filename:     string;
      imageBase64:  string;
      maskBase64:   string;
      doctorRating?: { stars: number | null; note: string | null };
    };

    if (!filename || !imageBase64 || !maskBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const baseName  = path.parse(filename).name;
    const ext       = path.parse(filename).ext || ".jpg";
    const baseDir   = path.join(process.cwd(), "annotation_output", "esophagitis");
    const imagesDir = path.join(baseDir, "images");
    const masksDir  = path.join(baseDir, "masks");

    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(masksDir,  { recursive: true });

    // Save original image
    const imgData  = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    await fs.writeFile(
      path.join(imagesDir, `${baseName}${ext}`),
      Buffer.from(imgData, "base64")
    );

    // Save binary mask
    const maskData = maskBase64.replace(/^data:image\/\w+;base64,/, "");
    await fs.writeFile(
      path.join(masksDir, `${baseName}.png`),
      Buffer.from(maskData, "base64")
    );

    // ── Save doctor rating to Supabase DB ──────────────────────────────────
    if (doctorRating && (doctorRating.stars !== null || doctorRating.note !== null)) {
      const { error: ratingErr } = await supabaseAdmin.from("annotation_ratings").upsert(
        {
          image_name: baseName,
          stars:      doctorRating.stars,
          note:       doctorRating.note,
          saved_at:   new Date().toISOString(),
        },
        { onConflict: "image_name" }
      );
      if (ratingErr) console.error("[annotation/save-esophagitis] rating upsert error:", ratingErr);
    }

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    await ensureBucket();
    await Promise.all([
      supabaseAdmin.storage.from(BUCKET).upload(
        `esophagitis/images/${baseName}${ext}`,
        Buffer.from(imgData, "base64"),
        { upsert: true, contentType: ext === ".png" ? "image/png" : "image/jpeg" }
      ),
      supabaseAdmin.storage.from(BUCKET).upload(
        `esophagitis/masks/${baseName}.png`,
        Buffer.from(maskData, "base64"),
        { upsert: true, contentType: "image/png" }
      ),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[annotation/save-esophagitis]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
