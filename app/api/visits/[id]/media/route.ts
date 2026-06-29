// // // // import { NextRequest, NextResponse } from "next/server";
// // // // import { prisma } from "@/lib/prisma";
// // // // import { writeFile, mkdir } from "fs/promises";
// // // // import path from "path";

// // // // export async function POST(
// // // //   req: NextRequest,
// // // //   { params }: { params: { id: string } }
// // // // ) {
// // // //   try {
// // // //     const formData = await req.formData();
// // // //     const file = formData.get("file") as File;
// // // //     if (!file) {
// // // //       return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
// // // //     }

// // // //     // Save to /public/uploads
// // // //     const buffer = Buffer.from(await file.arrayBuffer());
// // // //     const uploadsDir = path.join(process.cwd(), "public", "uploads");
// // // //     await mkdir(uploadsDir, { recursive: true });

// // // //     const filename = `${Date.now()}-${file.name}`;
// // // //     const filePath = path.join(uploadsDir, filename);
// // // //     await writeFile(filePath, buffer);

// // // //     const media = await prisma.visitMedia.create({
// // // //       data: {
// // // //         visitId: params.id,
// // // //         mediaType: file.type.startsWith("video") ? "video" : "image",
// // // //         filename: file.name,
// // // //         storageUrl: `/uploads/${filename}`,
// // // //         mimeType: file.type,
// // // //         sizeBytes: file.size,
// // // //         captureSource: "upload",
// // // //       },
// // // //     });

// // // //     return NextResponse.json({ media }, { status: 201 });
// // // //   } catch (err) {
// // // //     console.error(err);
// // // //     return NextResponse.json(
// // // //       { error: "Internal server error" },
// // // //       { status: 500 }
// // // //     );
// // // //   }
// // // // }


// // // // import { NextRequest, NextResponse } from "next/server";
// // // // import { prisma } from "@/lib/prisma";
// // // // import { supabase } from "@/lib/supabase"; // ✅ تأكدي عندك هذا

// // // // export async function POST(
// // // //   req: NextRequest,
// // // //   { params }: { params: { id: string } }
// // // // ) {
// // // //   try {
// // // //     const formData = await req.formData();
// // // //     const file = formData.get("file") as File;

// // // //     if (!file) {
// // // //       return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
// // // //     }

// // // //     const buffer = Buffer.from(await file.arrayBuffer());

// // // //     // ✅ اسم unique
// // // //     const filename = `${Date.now()}-${file.name}`;

// // // //     // ✅ upload to Supabase
// // // //     const { error: uploadError } = await supabase.storage
// // // //       .from("uploads")
// // // //       .upload(filename, buffer, {
// // // //         contentType: file.type,
// // // //       });

// // // //     if (uploadError) {
// // // //       console.error("Upload error:", uploadError);
// // // //       return NextResponse.json(
// // // //         { error: "Upload failed" },
// // // //         { status: 500 }
// // // //       );
// // // //     }

// // // //     // ✅ نجيب public URL
// // // //     const {
// // // //       data: { publicUrl },
// // // //     } = supabase.storage.from("uploads").getPublicUrl(filename);

// // // //     // ✅ نخزن في DB
// // // //     const media = await prisma.visitMedia.create({
// // // //       data: {
// // // //         visitId: params.id,
// // // //         mediaType: file.type.startsWith("video") ? "video" : "image",
// // // //         filename: file.name,
// // // //         storageUrl: publicUrl, // 🔥 هذا هو الصح
// // // //         mimeType: file.type,
// // // //         sizeBytes: file.size,
// // // //         captureSource: "upload",
// // // //       },
// // // //     });

// // // //     return NextResponse.json({ media }, { status: 201 });

// // // //   } catch (err) {
// // // //     console.error(err);
// // // //     return NextResponse.json(
// // // //       { error: "Internal server error" },
// // // //       { status: 500 }
// // // //     );
// // // //   }
// // // // }

// // // import { NextRequest, NextResponse } from "next/server";
// // // import { prisma } from "@/lib/prisma";
// // // import { supabase } from "@/lib/supabase";

// // // export async function POST(
  
// // //   req: NextRequest,
// // //   context: { params: Promise<{ id: string }> }
// // // ) {
// // //   try {
// // //     const { id: visitId } = await context.params;
// // //     const formData = await req.formData();
// // //     const file = formData.get("file") as File | null;

// // //     if (!file) {
// // //       return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
// // //     }

// // //     // ── Supabase upload ──
// // //     const filename    = `visits/${visitId}/${Date.now()}-${file.name}`;
// // //     const arrayBuffer = await file.arrayBuffer();
// // //     const buffer      = Buffer.from(arrayBuffer);

// // //     const { error: uploadError } = await supabase.storage
// // //       .from("uploads")
// // //       .upload(filename, buffer, { contentType: file.type, upsert: false });

// // //     if (uploadError) {
// // //       return NextResponse.json({ error: uploadError.message }, { status: 500 });
// // //     }

// // //     // ── Public URL ──
// // //     const { data: { publicUrl } } = supabase.storage
// // //       .from("uploads")
// // //       .getPublicUrl(filename);

// // //     // ── DB row بـ storageUrl حقيقي ──
// // //     const media = await prisma.visitMedia.create({
// // //       data: {
// // //         visitId,
// // //         mediaType:     file.type.startsWith("video") ? "video" : "image",
// // //         filename:      file.name,
// // //         storageUrl:    publicUrl,   // ✅ مو local path
// // //         mimeType:      file.type,
// // //         sizeBytes:     file.size,
// // //         captureSource: "upload",
// // //       },
// // //     });

// // //     return NextResponse.json({ media }, { status: 201 });
// // //   } catch (err: any) {
// // //     console.error("[visits/media POST]", err);
// // //     return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
// // //   }
// // // }

// // // export async function GET(
// // //   _: NextRequest,
// // //   context: { params: Promise<{ id: string }> }
// // // ) {
// // //   try {
// // //     const { id: visitId } = await context.params;
// // //     const media = await prisma.visitMedia.findMany({
// // //       where: { visitId },
// // //       orderBy: { uploadedAt: "desc" },
// // //     });
// // //     return NextResponse.json({ media });
// // //   } catch (err: any) {
// // //     return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
// // //   }
// // // }


// // import { NextRequest, NextResponse } from "next/server";
// // import { prisma } from "@/lib/prisma";
// // import { supabase } from "@/lib/supabase";

// // export async function POST(
// //   req: NextRequest,
// //   { params }: { params: { id: string } } // ✅ ماشي Promise
// // ) {
// //   try {
// //     const visitId = params.id;

// //     console.log("📌 visitId:", visitId);

// //     const formData = await req.formData();
// //     const file = formData.get("file") as File | null;

// //     if (!file) {
// //       return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
// //     }

// //     console.log("📂 file:", file.name);
// //     console.log("📏 size:", file.size);

// //     // ── Supabase upload ──
// //     const filename = `visits/${visitId}/${Date.now()}-${file.name}`;

// //     const arrayBuffer = await file.arrayBuffer();
// //     const buffer = Buffer.from(arrayBuffer);

// //     console.log("🚀 uploading to supabase...");

// //     const { error: uploadError } = await supabase.storage
// //       .from("uploads")
// //       .upload(filename, buffer, {
// //         contentType: file.type,
// //         upsert: true, // ✅ مهم
// //       });

// //     if (uploadError) {
// //       console.error("❌ Upload error:", uploadError);
// //       return NextResponse.json(
// //         { error: uploadError.message },
// //         { status: 500 }
// //       );
// //     }

// //     // ── Public URL ──
// //     const {
// //       data: { publicUrl },
// //     } = supabase.storage.from("uploads").getPublicUrl(filename);

// //     console.log("🌐 publicUrl:", publicUrl);

// //     // ── Save in DB ──
// //     const media = await prisma.visitMedia.create({
// //       data: {
// //         visitId,
// //         mediaType: file.type.startsWith("video") ? "video" : "image",
// //         filename: file.name,
// //         storageUrl: publicUrl, // ✅ الرابط الحقيقي
// //         mimeType: file.type,
// //         sizeBytes: file.size,
// //         captureSource: "upload",
// //       },
// //     });

// //     console.log("✅ media saved:", media.id);

// //     return NextResponse.json({ media }, { status: 201 });

// //   } catch (err: any) {
// //     console.error("🔥 MEDIA ERROR:", err);
// //     return NextResponse.json(
// //       { error: err.message ?? "Server error" },
// //       { status: 500 }
// //     );
// //   }
// // }

// // export async function GET(
// //   _: NextRequest,
// //   { params }: { params: { id: string } } // ✅ نفس التصحيح هنا
// // ) {
// //   try {
// //     const visitId = params.id;

// //     const media = await prisma.visitMedia.findMany({
// //       where: { visitId },
// //       orderBy: { uploadedAt: "desc" },
// //     });

// //     return NextResponse.json({ media });

// //   } catch (err: any) {
// //     console.error("🔥 GET MEDIA ERROR:", err);
// //     return NextResponse.json(
// //       { error: err.message ?? "Server error" },
// //       { status: 500 }
// //     );
// //   }
// // }


// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { supabase } from "@/lib/supabase";

// export async function POST(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> } // ✅ Promise
// ) {
//   try {
//     const { id: visitId } = await context.params; // ✅ await

//     console.log("📌 visitId:", visitId);

//     const formData = await req.formData();
//     const file = formData.get("file") as File | null;

//     if (!file) {
//       return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
//     }

//     const filename = `visits/${visitId}/${Date.now()}-${file.name}`;
//     const buffer = Buffer.from(await file.arrayBuffer());

//     const { error: uploadError } = await supabase.storage
//       .from("uploads")
//       .upload(filename, buffer, {
//         contentType: file.type,
//         upsert: true,
//       });

//     if (uploadError) {
//       console.error("❌ Upload error:", uploadError);
//       throw uploadError;
//     }

//     const {
//       data: { publicUrl },
//     } = supabase.storage.from("uploads").getPublicUrl(filename);

//     const media = await prisma.visitMedia.create({
//       data: {
//         visitId,
//         mediaType: file.type.startsWith("video") ? "video" : "image",
//         filename: file.name,
//         storageUrl: publicUrl,
//         mimeType: file.type,
//         sizeBytes: file.size,
//         captureSource: "upload",
//       },
//     });

//     return NextResponse.json({ media }, { status: 201 });

//   } catch (err: any) {
//     console.error("🔥 MEDIA ERROR:", err);
//     return NextResponse.json(
//       { error: err.message ?? "Server error" },
//       { status: 500 }
//     );
//   }
// }


// app/api/visits/[id]/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { sanitizeStorageKey } from "@/lib/storageKey";

// ─── Helper: upload a base64 string to Supabase ────────────────────────────────
async function uploadBase64(
  base64: string,
  path: string,
  mimeType: string
): Promise<string | null> {
  try {
    // strip data:image/...;base64, prefix if present
    const data = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(data, "base64");
    const { error } = await supabase.storage
      .from("uploads")
      .upload(path, buffer, { contentType: mimeType, upsert: true });
    if (error) { console.error("❌ base64 upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
    return publicUrl;
  } catch (e) {
    console.error("❌ uploadBase64 error:", e);
    return null;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: visitId } = await context.params;

    const formData = await req.formData();
    const file         = formData.get("file")          as File   | null;
    const doctorId     = formData.get("doctorId")      as string | null;
    const annotatedB64 = formData.get("annotatedB64")  as string | null;
    const gradcamB64   = formData.get("gradcamB64")    as string | null;
    const overlayB64   = formData.get("overlayB64")    as string | null;
    const captureSource = (formData.get("captureSource") as string | null) ?? "upload";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ts       = Date.now();
    const filename = `visits/${visitId}/${ts}-${sanitizeStorageKey(file.name)}`;
    const buffer   = Buffer.from(await file.arrayBuffer());

    // 1️⃣ رفع الصورة الأصلية
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filename, buffer, { contentType: file.type, upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl: originalUrl } } = supabase.storage
      .from("uploads")
      .getPublicUrl(filename);

    // 2️⃣ رفع الصور الإضافية إذا موجودة
    const annotatedUrl = annotatedB64
      ? await uploadBase64(annotatedB64, `visits/${visitId}/${ts}-annotated.jpg`, "image/jpeg")
      : null;

    const gradcamUrl = gradcamB64
      ? await uploadBase64(gradcamB64, `visits/${visitId}/${ts}-gradcam.jpg`, "image/jpeg")
      : null;

    const overlayUrl = overlayB64
      ? await uploadBase64(overlayB64, `visits/${visitId}/${ts}-overlay.jpg`, "image/jpeg")
      : null;

    // 3️⃣ حفظ في الداتابيز
    const media = await prisma.visitMedia.create({
      data: {
        visitId,
        mediaType:     file.type.startsWith("video") ? "video" : "image",
        filename:      file.name,
        storageUrl:    originalUrl,
        mimeType:      file.type,
        sizeBytes:     file.size,
        captureSource,
        ...(annotatedUrl && { annotatedUrl }),
        ...(gradcamUrl   && { gradcamUrl }),
        ...(overlayUrl   && { overlayUrl }),
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (err: any) {
    console.error("🔥 MEDIA ERROR:", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: visitId } = await context.params;
    const body = await req.json();
    const { mediaId, overlayB64 } = body as { mediaId: string; overlayB64: string };

    if (!mediaId || !overlayB64) {
      return NextResponse.json({ error: "mediaId and overlayB64 are required" }, { status: 400 });
    }

    const ts = Date.now();
    const overlayUrl = await uploadBase64(
      overlayB64,
      `visits/${visitId}/${ts}-overlay.jpg`,
      "image/jpeg"
    );

    if (!overlayUrl) {
      return NextResponse.json({ error: "Failed to upload overlay" }, { status: 500 });
    }

    const media = await prisma.visitMedia.update({
      where: { id: mediaId },
      data: { overlayUrl },
    });

    return NextResponse.json({ media });
  } catch (err: any) {
    console.error("🔥 PATCH MEDIA ERROR:", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}