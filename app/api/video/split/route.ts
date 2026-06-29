import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { splitVideo, getVideoMetadata, createTempDir, cleanupDir } from "@/lib/ffmpeg";
import fs from "fs";
import path from "path";

export const maxDuration = 300;
export const dynamic     = "force-dynamic";

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    tempDir = createTempDir("gastro_split_");
    const ext       = getExt(file.name);
    const videoPath = path.join(tempDir, `video${ext}`);
    fs.writeFileSync(videoPath, Buffer.from(await file.arrayBuffer()));

    const meta = await getVideoMetadata(videoPath);

    // Short video — no split needed
    if (meta.durationSeconds <= 30) {
      cleanupDir(tempDir);
      return NextResponse.json({ needsSplit: false, durationSecs: meta.durationSeconds });
    }

    const partsDir  = path.join(tempDir, "parts");
    const splitParts = await splitVideo(videoPath, partsDir, 30);

    const splitId = Date.now().toString();
    const parts   = [];

    for (const sp of splitParts) {
      const buf         = fs.readFileSync(sp.filePath);
      const storagePath = `temp_splits/${splitId}/part_${String(sp.index).padStart(3, "0")}.mp4`;

      const { error } = await supabase.storage
        .from("uploads")
        .upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("uploads")
        .getPublicUrl(storagePath);

      parts.push({
        index:       sp.index,
        startSecs:   sp.startSecs,
        endSecs:     sp.endSecs,
        durationSecs: sp.endSecs - sp.startSecs,
        url:         publicUrl,
        storagePath,
      });
    }

    cleanupDir(tempDir);

    return NextResponse.json({
      needsSplit:  true,
      splitId,
      totalParts:  parts.length,
      durationSecs: meta.durationSeconds,
      parts,
    });
  } catch (err: any) {
    if (tempDir) cleanupDir(tempDir);
    console.error("[video/split]", err);
    return NextResponse.json({ error: err.message ?? "Split failed" }, { status: 500 });
  }
}

function getExt(filename: string): string {
  const p = filename.split(".");
  return p.length > 1 ? `.${p[p.length - 1]}` : ".mp4";
}
