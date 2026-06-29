import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { extractFrames, getVideoMetadata, createTempDir, cleanupDir } from "@/lib/ffmpeg";
import fs from "fs";
import path from "path";

/** Upload a small buffer to Supabase with a per-attempt timeout.
 *  Retries up to `maxAttempts` times. Returns publicUrl or null on failure. */
async function uploadToSupabase(
  bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType: string,
  timeoutMs = 20_000,
  maxAttempts = 3,
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, { contentType, upsert: true });
      clearTimeout(timer);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return publicUrl;
    } catch (err: any) {
      clearTimeout(timer);
      console.warn(`[supabase upload] attempt ${attempt}/${maxAttempts} failed for ${filePath}:`, err?.message);
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 1_000));
    }
  }
  return null;
}

export const maxDuration = 180;
export const dynamic     = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let tempVideoDir: string | null = null;
  let framesDir:    string | null = null;

  try {
    const { id: visitId } = await context.params;
    const formData = await req.formData();
    const file     = formData.get("file")     as File   | null;
    const doctorId = formData.get("doctorId") as string | null;
    const fpsStr   = formData.get("fps")      as string | null;
    const fps      = fpsStr ? Math.min(Number(fpsStr), 3) : 2; // max 3 fps, default 2

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    // ── 1. Save video to temp ────────────────────────────────────────────────
    tempVideoDir = createTempDir("gastro_video_");
    const tempVideoPath = path.join(tempVideoDir, `video_${Date.now()}${getExt(file.name)}`);
    const videoBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempVideoPath, videoBuffer);

    // ── 2. Get video metadata ────────────────────────────────────────────────
    let metadata = { durationSeconds: 0, totalFrames: 0, fps, width: 1920, height: 1080 };
    try {
      metadata = await getVideoMetadata(tempVideoPath);
    } catch (e) {
      console.warn("Could not read video metadata:", e);
    }

    // ── 3. Save VisitMedia (video file NOT uploaded server-side — too large for
    //        undici; storageUrl is filled later by the /transcode route) ──────
    const ts = Date.now();
    const visitMedia = await prisma.visitMedia.create({
      data: {
        visitId,
        mediaType:     "video",
        filename:      file.name,
        storageUrl:    "",           // filled in later via /api/video/transcode
        mimeType:      file.type,
        sizeBytes:     file.size,
        durationSecs:  Math.round(metadata.durationSeconds),
        captureSource: "upload",
      },
    });

    // ── 5. Extract frames ────────────────────────────────────────────────────
    framesDir = createTempDir("gastro_frames_");
    const frameInfos = await extractFrames(tempVideoPath, framesDir, fps, 60); // max 60 frames

    // ── 6. Upload frames to Supabase + save VideoFrame ───────────────────────
    const frameRecords = [];

    for (const fi of frameInfos) {
      try {
        const frameBuffer   = fs.readFileSync(fi.filePath);
        const frameFilename = `visits/${visitId}/frames/${ts}/frame_${String(fi.frameIndex).padStart(4, "0")}.jpg`;

        // Small JPEG (~50-100 KB) — use retry helper with 20s timeout per attempt
        const frameUrl = await uploadToSupabase("uploads", frameFilename, frameBuffer, "image/jpeg");
        if (!frameUrl) {
          console.warn(`Frame ${fi.frameIndex} upload failed after retries — skipping`);
          continue;
        }

        const record = await prisma.videoFrame.create({
          data: {
            mediaId:          visitMedia.id,
            frameIndex:       fi.frameIndex,
            timestampSeconds: fi.timestampSeconds,
            frameUrl:         frameUrl,
            hasDetection:     false,
          },
        });

        frameRecords.push({
          id:               record.id,
          frameIndex:       fi.frameIndex,
          timestampSeconds: fi.timestampSeconds,
          frameUrl:         frameUrl,
        });
      } catch (frameErr) {
        console.warn(`Frame ${fi.frameIndex} error:`, frameErr);
      }
    }

    // ── 7. Update totalFrames ────────────────────────────────────────────────
    await prisma.visitMedia.update({
      where: { id: visitMedia.id },
      data:  { totalFrames: frameRecords.length },
    });

    // ── 8. Cleanup temp files ────────────────────────────────────────────────
    cleanupDir(framesDir);
    cleanupDir(tempVideoDir);

    return NextResponse.json({
      media: {
        id:           visitMedia.id,
        storageUrl:   "",            // filled later by /api/video/transcode
        durationSecs: Math.round(metadata.durationSeconds),
        totalFrames:  frameRecords.length,
        fps,
      },
      frames:  frameRecords,
      message: `Video processed: ${frameRecords.length} frames extracted`,
    }, { status: 201 });

  } catch (err: any) {
    if (framesDir)    cleanupDir(framesDir);
    if (tempVideoDir) cleanupDir(tempVideoDir);
    console.error("[video/upload]", err);
    return NextResponse.json(
      { error: err.message ?? "Video processing failed" },
      { status: 500 }
    );
  }
}

function getExt(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : ".mp4";
}
