// // // lib/ffmpeg.ts
// // // Helper: يقسم فيديو إلى frames باستعمال fluent-ffmpeg
// // import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
// // import ffmpeg from "fluent-ffmpeg";
// // import fs from "fs";
// // import path from "path";
// // import os from "os";

// // // نوجه fluent-ffmpeg لمسار ffmpeg المثبت
// // ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// // export interface FrameInfo {
// //   frameIndex: number;       // رقم الـ frame (0-based)
// //   timestampSeconds: number; // الوقت في الفيديو
// //   filePath: string;         // مسار الملف المؤقت
// // }

// // export interface VideoMetadata {
// //   durationSeconds: number;
// //   totalFrames: number;
// //   fps: number;
// //   width: number;
// //   height: number;
// // }

// // /**
// //  * يجيب metadata تاع الفيديو
// //  */
// // export function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
// //   return new Promise((resolve, reject) => {
// //     ffmpeg.ffprobe(videoPath, (err, metadata) => {
// //       if (err) return reject(err);

// //       const stream = metadata.streams.find(s => s.codec_type === "video");
// //       const duration = metadata.format.duration ?? 0;

// //       // حساب fps من r_frame_rate مثلاً "25/1"
// //       let fps = 25;
// //       if (stream?.r_frame_rate) {
// //         const parts = stream.r_frame_rate.split("/");
// //         fps = parts.length === 2
// //           ? Math.round(Number(parts[0]) / Number(parts[1]))
// //           : Number(parts[0]);
// //       }

// //       resolve({
// //         durationSeconds: Number(duration),
// //         totalFrames:     Math.floor(Number(duration) * fps),
// //         fps:             fps || 25,
// //         width:           stream?.width  ?? 1920,
// //         height:          stream?.height ?? 1080,
// //       });
// //     });
// //   });
// // }

// // /**
// //  * @param videoPath  مسار الفيديو
// //  * @param outputDir  مجلد الـ output
// //  * @param fps        عدد frames في الثانية (default: 2 — كافي لـ endoscopy)
// //  * @param maxFrames  حد أقصى (default: 120 = دقيقتين بـ fps=1)
// //  */
// // export function extractFrames(
// //   videoPath:  string,
// //   outputDir:  string,
// //   fps:        number = 2,
// //   maxFrames:  number = 120,
// // ): Promise<FrameInfo[]> {
// //   return new Promise((resolve, reject) => {
// //     if (!fs.existsSync(outputDir)) {
// //       fs.mkdirSync(outputDir, { recursive: true });
// //     }

// //     ffmpeg(videoPath)
// //       .outputOptions([
// //         `-vf fps=${fps}`,          
// //         `-frames:v ${maxFrames}`,  
// //         `-q:v 2`,                  
// //       ])
// //       .output(path.join(outputDir, "frame_%04d.jpg"))
// //       .on("end", () => {
// //         const files = fs
// //           .readdirSync(outputDir)
// //           .filter(f => f.startsWith("frame_") && f.endsWith(".jpg"))
// //           .sort();

// //         const frames: FrameInfo[] = files.map((file, i) => ({
// //           frameIndex:       i,
// //           timestampSeconds: i / fps,
// //           filePath:         path.join(outputDir, file),
// //         }));

// //         resolve(frames);
// //       })
// //       .on("error", reject)
// //       .run();
// //   });
// // }


// // export function cleanupDir(dir: string): void {
// //   try {
// //     if (fs.existsSync(dir)) {
// //       fs.rmSync(dir, { recursive: true, force: true });
// //     }
// //   } catch (e) {
// //     console.warn("Cleanup warning:", e);
// //   }
// // }


// // export function createTempDir(prefix = "gastro_frames_"): string {
// //   return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
// // }


// // lib/ffmpeg.ts
// import ffmpegPath from "ffmpeg-static";
// import fs from "fs";
// import os from "os";
// import path from "path";
// import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
// import ffmpeg from "fluent-ffmpeg";

// ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// export interface FrameInfo {
//   frameIndex:       number;
//   timestampSeconds: number;
//   filePath:         string;
// }

// export interface VideoMetadata {
//   durationSeconds: number;
//   totalFrames:     number;
//   fps:             number;
//   width:           number;
//   height:          number;
// }

// export function createTempDir(prefix: string): string {
//   return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
// }

// export function cleanupDir(dirPath: string): void {
//   try {
//     if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
//   } catch (e) {
//     console.warn("[ffmpeg] cleanupDir failed:", e);
//   }
// }

// export async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
//   return new Promise((resolve, reject) => {
//     ffmpeg.ffprobe(videoPath, (err, metadata) => {
//       if (err) return reject(err);
//       const format      = metadata.format;
//       const videoStream = metadata.streams.find(s => s.codec_type === "video");
//       const durationSeconds = format.duration ?? 0;
//       const width           = videoStream?.width  ?? 1920;
//       const height          = videoStream?.height ?? 1080;
//       let fps = 25;
//       if (videoStream?.r_frame_rate) {
//         const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
//         if (den && den > 0) fps = Math.round(num / den);
//       }
//       resolve({ durationSeconds, totalFrames: Math.ceil(durationSeconds * fps), fps, width, height });
//     });
//   });
// }

// export async function extractFrames(
//   videoPath: string,
//   outputDir: string,
//   fps:       number = 2,
//   maxFrames: number = 150
// ): Promise<FrameInfo[]> {
//   if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//   let limitDuration: number | null = null;
//   try {
//     const meta = await getVideoMetadata(videoPath);
//     const maxDur = maxFrames / fps;
//     if (meta.durationSeconds > maxDur) limitDuration = maxDur;
//   } catch (_) {}

//   await new Promise<void>((resolve, reject) => {
//     const cmd = ffmpeg(videoPath).outputOptions([`-vf fps=${fps}`, "-q:v 3", "-f image2"]);
//     if (limitDuration) cmd.outputOptions([`-t ${limitDuration}`]);
//     cmd
//       .output(path.join(outputDir, "frame_%04d.jpg"))
//       .on("end",   () => resolve())
//       .on("error", (err: Error) => reject(err))
//       .run();
//   });

//   const files = fs
//     .readdirSync(outputDir)
//     .filter(f => f.startsWith("frame_") && f.endsWith(".jpg"))
//     .sort();

//   return files.slice(0, maxFrames).map((filename, i) => ({
//     frameIndex:       i,
//     timestampSeconds: i / fps,
//     filePath:         path.join(outputDir, filename),
//   }));
// }

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface FrameInfo {
  frameIndex:       number;
  timestampSeconds: number;
  filePath:         string;
}

export interface VideoMetadata {
  durationSeconds: number;
  totalFrames:     number;
  fps:             number;
  width:           number;
  height:          number;
}

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (e) {
    console.warn("[ffmpeg] cleanupDir failed:", e);
  }
}

export async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const format      = metadata.format;
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const durationSeconds = format.duration ?? 0;
      const width           = videoStream?.width  ?? 1920;
      const height          = videoStream?.height ?? 1080;
      let fps = 25;
      if (videoStream?.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
        if (den && den > 0) fps = Math.round(num / den);
      }
      resolve({
        durationSeconds,
        totalFrames: Math.ceil(durationSeconds * fps),
        fps,
        width,
        height,
      });
    });
  });
}

export interface VideoPart {
  index:       number;
  startSecs:   number;
  endSecs:     number;
  filePath:    string;
}

export async function splitVideo(
  videoPath:       string,
  outputDir:       string,
  segmentDuration: number = 30,
): Promise<VideoPart[]> {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const meta     = await getVideoMetadata(videoPath);
  const total    = meta.durationSeconds;
  const numParts = Math.ceil(total / segmentDuration);
  const parts: VideoPart[] = [];

  for (let i = 0; i < numParts; i++) {
    const startSecs = i * segmentDuration;
    const duration  = Math.min(segmentDuration, total - startSecs);
    const outPath   = path.join(outputDir, `part_${String(i).padStart(3, "0")}.mp4`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startSecs)
        .setDuration(duration)
        .outputOptions(["-c:v libx264", "-c:a aac", "-preset ultrafast", "-crf 23"])
        .output(outPath)
        .on("end",   () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    parts.push({ index: i, startSecs, endSecs: startSecs + duration, filePath: outPath });
  }

  return parts;
}

export async function extractFrames(
  videoPath:  string,
  outputDir:  string,
  fps:        number = 10,   // ✅ رفعنا من 2 → 10
  maxFrames:  number = 500   // ✅ رفعنا من 150 → 500
): Promise<FrameInfo[]> {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let limitDuration: number | null = null;
  try {
    const meta   = await getVideoMetadata(videoPath);
    const maxDur = maxFrames / fps;
    if (meta.durationSeconds > maxDur) limitDuration = maxDur;
  } catch (_) {}

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg(videoPath).outputOptions([
      `-vf fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      "-pix_fmt yuv420p",  // force standard pixel format — fixes black frames on AVI
      "-q:v 2",
      "-f image2",
    ]);
    if (limitDuration) cmd.outputOptions([`-t ${limitDuration}`]);
    cmd
      .output(path.join(outputDir, "frame_%04d.jpg"))
      .on("end",   () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });

  const files = fs
    .readdirSync(outputDir)
    .filter(f => f.startsWith("frame_") && f.endsWith(".jpg"))
    .sort();

  return files.slice(0, maxFrames).map((filename, i) => ({
    frameIndex:       i,
    timestampSeconds: i / fps,
    filePath:         path.join(outputDir, filename),
  }));
}