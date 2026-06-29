// // app/api/visits/[id]/video/process/route.ts
// // يستقبل frameId → يبعتو للـ AI → يحفظ النتيجة

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { supabase } from "@/lib/supabase";

// const AI_SERVER = process.env.AI_SERVER_URL ?? "http://localhost:8000";

// export async function POST(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { id: visitId } = await context.params;
//     const body = await req.json();
//     const { frameId, frameUrl, doctorId, analysisType = "detection" } = body;

//     if (!frameId || !frameUrl) {
//       return NextResponse.json({ error: "frameId and frameUrl required" }, { status: 400 });
//     }

//     // ── 1. حمّل الـ frame من Supabase ─────────────────────────────
//     const frameRes = await fetch(frameUrl);
//     if (!frameRes.ok) {
//       return NextResponse.json({ error: "Could not fetch frame" }, { status: 400 });
//     }
//     const frameBuffer = await frameRes.arrayBuffer();
//     const frameBlob   = new Blob([frameBuffer], { type: "image/jpeg" });
//     const frameFile   = new File([frameBlob], "frame.jpg", { type: "image/jpeg" });

//     // ── 2. بعت للـ AI ──────────────────────────────────────────────
//     const aiForm = new FormData();
//     aiForm.append("file", frameFile);

//     const endpoint = analysisType === "segmentation" ? "/segment" : "/analyze";
//     const aiRes    = await fetch(`${AI_SERVER}${endpoint}`, {
//       method: "POST",
//       body:   aiForm,
//     });

//     if (!aiRes.ok) {
//       const err = await aiRes.json().catch(() => ({}));
//       return NextResponse.json(
//         { error: (err as any).detail ?? "AI analysis failed" },
//         { status: 500 }
//       );
//     }

//     const aiData = await aiRes.json();

//     // ── 3. استخرج النتائج حسب نوع التحليل ────────────────────────
//     const hasDetection = analysisType === "segmentation"
//       ? (aiData.segments?.length ?? 0) > 0
//       : (aiData.detections?.length ?? 0) > 0;

//     const overallRisk = aiData.overallRisk ?? "normal";

//     // ── 4. رفع الـ annotated frame إذا موجود ──────────────────────
//     let annotatedUrl: string | null = null;
//     let gradcamUrl:   string | null = null;
//     let overlayUrl:   string | null = null;

//     const frameRecord = await prisma.videoFrame.findUnique({ where: { id: frameId } });
//     if (!frameRecord) {
//       return NextResponse.json({ error: "Frame not found" }, { status: 404 });
//     }

//     const ts      = Date.now();
//     const basePath = `visits/${visitId}/frames/processed`;

//     // رفع صورة الـ overlay (segmentation)
//     if (analysisType === "segmentation" && aiData.overlayBase64) {
//       const buf = Buffer.from(aiData.overlayBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
//       const p   = `${basePath}/${frameRecord.frameIndex}_overlay.jpg`;
//       await supabase.storage.from("uploads").upload(p, buf, { contentType: "image/jpeg", upsert: true });
//       overlayUrl = supabase.storage.from("uploads").getPublicUrl(p).data.publicUrl;
//     }

//     // رفع Grad-CAM
//     const gradcamB64 = aiData.detections?.[0]?.gradcamBase64 ?? null;
//     if (gradcamB64) {
//       const buf = Buffer.from(gradcamB64.replace(/^data:[^;]+;base64,/, ""), "base64");
//       const p   = `${basePath}/${frameRecord.frameIndex}_gradcam.jpg`;
//       await supabase.storage.from("uploads").upload(p, buf, { contentType: "image/jpeg", upsert: true });
//       gradcamUrl = supabase.storage.from("uploads").getPublicUrl(p).data.publicUrl;
//     }

//     // ── 5. تحديث VideoFrame.hasDetection ─────────────────────────
//     await prisma.videoFrame.update({
//       where: { id: frameId },
//       data:  { hasDetection: hasDetection },
//     });

//     // ── 6. إذا كاين detection — نحفظ DetectionFrame ──────────────
//     if (hasDetection) {
//       const lesions = analysisType === "segmentation"
//         ? (aiData.segments ?? [])
//         : (aiData.detections ?? []);

//       // نحتاج analysisResult مرتبط بالـ media
//       // نجيبو من الـ frame → media → analysisResult
//       const media = await prisma.visitMedia.findUnique({
//         where:   { id: frameRecord.mediaId },
//         include: { analysisResults: { take: 1 } },
//       });

//       let analysisId = media?.analysisResults?.[0]?.id ?? null;

//       // إذا ما كانش analysis — نخلقو
//       if (!analysisId && doctorId) {
//         const newAnalysis = await prisma.analysisResult.create({
//           data: {
//             visitId,
//             mediaId:             frameRecord.mediaId,
//             doctorId,
//             analysisType,
//             modelVersion:        aiData.modelVersion ?? "AI Model",
//             overallConfidence:   lesions[0]?.confidence ?? 0,
//             overallRisk,
//             framesWithDetection: 1,
//             status:              "processing",
//             rawOutput:           "",
//           },
//         });
//         analysisId = newAnalysis.id;
//       }

//       // نخزن DetectedLesions + DetectionFrame
//       if (analysisId) {
//         for (const lesion of lesions) {
//           const detectedLesion = await prisma.detectedLesion.create({
//             data: {
//               analysisId,
//               lesionType:     lesion.label   ?? "Unknown",
//               classification: lesion.label   ?? "",
//               confidence:     Number(lesion.confidence ?? 0),
//               severity:       lesion.severity ?? "normal",
//               location:       lesion.location ?? "",
//               boundingBox:    lesion.bbox ? JSON.stringify(lesion.bbox) : "",
//             },
//           });

//           await prisma.detectionFrame.create({
//             data: {
//               lesionId:       detectedLesion.id,
//               frameId,
//               annotatedUrl:   annotatedUrl ?? "",
//               maskUrl:        overlayUrl   ?? "",
//               frameConfidence: Number(lesion.confidence ?? 0),
//               displayOrder:   frameRecord.frameIndex,
//             },
//           });
//         }

//         // تحديث framesWithDetection
//         await prisma.analysisResult.update({
//           where: { id: analysisId },
//           data: {
//             framesWithDetection: { increment: 1 },
//             rawOutput: JSON.stringify(aiData),
//           },
//         });
//       }
//     }

//     // ── 7. نرجع النتيجة للـ client ────────────────────────────────
//     return NextResponse.json({
//       frameIndex:   frameRecord.frameIndex,
//       hasDetection,
//       overallRisk,
//       annotatedUrl,
//       gradcamUrl,
//       overlayUrl,
//       detections: analysisType === "detection"
//         ? (aiData.detections ?? []).map((d: any) => ({
//             label:      d.label,
//             confidence: Math.round(d.confidence),
//             severity:   d.severity,
//             location:   d.location,
//             bbox:       d.bbox,
//             gradcamBase64: d.gradcamBase64,
//           }))
//         : [],
//       segments: analysisType === "segmentation"
//         ? (aiData.segments ?? []).map((s: any) => ({
//             label:      s.label,
//             confidence: Math.round(s.confidence),
//             severity:   s.severity,
//             areaPct:    s.area_pct,
//           }))
//         : [],
//       overlayBase64: aiData.overlayBase64 ?? null,
//     });

//   } catch (err: any) {
//     console.error("[video/process]", err);
//     return NextResponse.json(
//       { error: err.message ?? "Frame processing failed" },
//       { status: 500 }
//     );
//   }
// }

// // GET — يرجع frames تاع visit معين
// export async function GET(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { id: visitId } = await context.params;

//     const media = await prisma.visitMedia.findFirst({
//       where:   { visitId, mediaType: "video" },
//       include: {
//         frames: {
//           orderBy: { frameIndex: "asc" },
//         },
//       },
//       orderBy: { uploadedAt: "desc" },
//     });

//     if (!media) {
//       return NextResponse.json({ frames: [], mediaId: null });
//     }

//     return NextResponse.json({
//       mediaId:      media.id,
//       totalFrames:  media.totalFrames,
//       durationSecs: media.durationSecs,
//       storageUrl:   media.storageUrl,
//       frames:       media.frames.map(f => ({
//         id:               f.id,
//         frameIndex:       f.frameIndex,
//         timestampSeconds: f.timestampSeconds,
//         frameUrl:         f.frameUrl,
//         hasDetection:     f.hasDetection,
//       })),
//     });
//   } catch (err: any) {
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }


// app/api/visits/[id]/video/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** fetch with configurable timeout + automatic retries */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  timeoutMs = 30_000,
  maxAttempts = 3
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      console.warn(`[fetchWithRetry] attempt ${attempt}/${maxAttempts} failed for ${url}:`, (err as any)?.message);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

// POST — يبعت frame واحد للـ AI ويحفظ النتيجة
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let frameId: string | undefined; // نحفظوه هنا حتى نقدروا نستعملوه في catch
  try {
    await context.params; // visitId متاح لكن ما نحتاجوش هنا
    const body = await req.json();
    frameId = body.frameId;
    const mediaId = body.mediaId;

    if (!frameId || !mediaId) {
      return NextResponse.json(
        { error: "frameId and mediaId are required" },
        { status: 400 }
      );
    }

    // 1. نجيب الـ frame
    const frame = await prisma.videoFrame.findUnique({ where: { id: frameId } });
    if (!frame) {
      return NextResponse.json({ error: "Frame not found" }, { status: 404 });
    }

    // 2. نحدث الحالة → processing
    await prisma.videoFrame.update({
      where: { id: frameId },
      data:  { processingStatus: "processing" },
    });

    // 3. نجيب صورة الـ frame من Supabase (retry × 3, timeout 30s)
    const imgResponse = await fetchWithRetry(frame.frameUrl, undefined, 30_000, 3);
    if (!imgResponse.ok) throw new Error(`Failed to fetch frame: ${imgResponse.status}`);
    const imgBlob = await imgResponse.blob();

    // 4. نبعت مباشرة للـ FastAPI /detect (YOLO فقط، بدون GradCAM++)
    const aiForm = new FormData();
    aiForm.append("file", imgBlob, `frame_${frame.frameIndex}.jpg`);

    const aiServer = process.env.AI_SERVER_URL ?? "http://localhost:8000";
    const aiRes    = await fetchWithRetry(`${aiServer}/detect`, { method: "POST", body: aiForm }, 60_000, 2);

    if (!aiRes.ok) {
      const errData = await aiRes.json().catch(() => ({}));
      await prisma.videoFrame.update({
        where: { id: frameId },
        data:  { processingStatus: "failed" },
      });
      return NextResponse.json({ error: "AI analysis failed", detail: errData }, { status: 500 });
    }

    const aiData    = await aiRes.json();
    const detections: any[] = aiData.detections ?? [];
    const hasDetection = detections.length > 0;

    // 5. نحفظ كل detection كـ FrameDetection (model الجديد في schema)
    for (const det of detections) {
      await prisma.frameDetection.create({
        data: {
          frameId,
          label:         det.label         ?? "Unknown",
          confidence:    det.confidence     ?? 0,
          severity:      det.severity       ?? "low",
          boundingBox:   JSON.stringify(det.bbox ?? {}),
          gradcamBase64: det.gradcamBase64  ?? "",
        },
      });
    }

    // 6. نحدث الـ frame بالنتائج
    await prisma.videoFrame.update({
      where: { id: frameId },
      data: {
        processingStatus: hasDetection ? "detection" : "done",
        hasDetection,
        analysisResult:  JSON.stringify(aiData),
        detectionCount:  detections.length,
        overallRisk:     aiData.overallRisk ?? "normal",
      },
    });

    return NextResponse.json({
      success:      true,
      frameIndex:   frame.frameIndex,
      timestampMs:  Math.round(frame.timestampSeconds * 1000),
      detections,
      overallRisk:  aiData.overallRisk  ?? "normal",
      modelVersion: aiData.modelVersion ?? "",
    });

  } catch (err: any) {
    console.error("[video/process]", err);
    // نعلّم الـ frame كـ failed حتى لا يبقى stuck في processing
    if (frameId) {
      await prisma.videoFrame.update({
        where: { id: frameId },
        data:  { processingStatus: "failed" },
      }).catch(() => {});
    }
    return NextResponse.json({ error: err.message ?? "Processing failed" }, { status: 500 });
  }
}

// GET — status تاع كل frames لـ media معين
export async function GET(
  req: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("mediaId");
    if (!mediaId) return NextResponse.json({ error: "mediaId required" }, { status: 400 });

    const frames = await prisma.videoFrame.findMany({
      where:   { mediaId },
      orderBy: { frameIndex: "asc" },
      select: {
        id:              true,
        frameIndex:      true,
        timestampSeconds: true,
        frameUrl:        true,
        processingStatus: true,
        hasDetection:    true,
        detectionCount:  true,
        overallRisk:     true,
      },
    });

    return NextResponse.json({
      frames,
      total:          frames.length,
      done:           frames.filter(f => ["done","detection"].includes(f.processingStatus)).length,
      withDetections: frames.filter(f => f.hasDetection).length,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}