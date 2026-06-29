import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createTempDir, cleanupDir } from "@/lib/ffmpeg";
import { sanitizeStorageKey } from "@/lib/storageKey";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const maxDuration = 180;
export const dynamic     = "force-dynamic";

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;
  try {
    const formData  = await req.formData();
    const file      = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    tempDir = createTempDir("gastro_transcode_");
    const ext        = getExt(file.name);
    const inputPath  = path.join(tempDir, `input${ext}`);
    const outputPath = path.join(tempDir, "output.mp4");

    fs.writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(["-c:v libx264", "-preset fast", "-crf 23",
          "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:a aac", "-movflags +faststart"])
        .output(outputPath)
        .on("end",   () => resolve())
        .on("error", (e: Error) => reject(e))
        .run();
    });

    const mp4Buffer = fs.readFileSync(outputPath);
    const filename  = `transcoded/${Date.now()}_${sanitizeStorageKey(path.basename(file.name, ext) + ".mp4")}`;

    const { error: uploadErr } = await supabase.storage
      .from("uploads")
      .upload(filename, mp4Buffer, { contentType: "video/mp4", upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(filename);

    return NextResponse.json({ mp4Url: publicUrl, storagePath: filename });
  } catch (err: any) {
    console.error("[transcode]", err);
    return NextResponse.json({ error: err.message ?? "Transcoding failed" }, { status: 500 });
  } finally {
    if (tempDir) cleanupDir(tempDir);
  }
}

function getExt(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : ".avi";
}
