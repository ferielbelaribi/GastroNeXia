import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const AI_SERVER_URL = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const save = formData.get("save") === "true";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Forward to AI server
    const aiForm = new FormData();
    aiForm.append("file", file);

    // CPU inference can take 10-30s — allow up to 3 minutes
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);

    let aiRes: Response;
    try {
      aiRes = await fetch(`${AI_SERVER_URL}/segment-esophagitis`, {
        method: "POST",
        body: aiForm,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return NextResponse.json({ error: err }, { status: aiRes.status });
    }

    const result = await aiRes.json();

    // Save files to disk — images/ and masks/ with matching filenames
    if (save) {
      const baseName  = path.parse(file.name).name;
      const ext       = path.parse(file.name).ext || ".jpg";
      const baseDir   = path.join(process.cwd(), "annotation_output", "esophagitis");
      const imagesDir = path.join(baseDir, "images");
      const masksDir  = path.join(baseDir, "masks");
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.mkdir(masksDir,  { recursive: true });

      // Save original
      const originalBuf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(imagesDir, `${baseName}${ext}`), originalBuf);

      // Save binary mask — same base name as original
      const maskB64 = result.maskBase64 as string | null;
      if (maskB64) {
        const maskData = maskB64.replace(/^data:image\/\w+;base64,/, "");
        await fs.writeFile(path.join(masksDir, `${baseName}.png`), Buffer.from(maskData, "base64"));
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[annotation/auto]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
