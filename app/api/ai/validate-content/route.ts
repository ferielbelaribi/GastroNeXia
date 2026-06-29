// app/api/ai/validate-content/route.ts
// Validates that an uploaded image (or video frame) is a gastrointestinal
// endoscopy image and not a random/unrelated photograph.

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Accept either a raw file OR a pre-encoded base64 string (for video frames)
    const file      = formData.get("file")      as File   | null;
    const frameUrl  = formData.get("frameUrl")  as string | null;
    const mediaTypeHint = (formData.get("mediaType") as string | null) ?? "image/jpeg";

    let imageData: string;
    let mimeType: string;

    if (frameUrl) {
      // Video frame: fetch the URL and convert to base64
      const res = await fetch(frameUrl);
      if (!res.ok) {
        // Can't fetch frame — allow through rather than block
        return NextResponse.json({ isValid: true, confidence: 0, reason: "Frame unavailable for validation" });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      imageData = buf.toString("base64");
      mimeType  = res.headers.get("content-type") ?? "image/jpeg";
    } else if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      imageData = buf.toString("base64");
      mimeType  = file.type || mediaTypeHint;
    } else {
      return NextResponse.json({ error: "No file or frameUrl provided" }, { status: 400 });
    }

    // Only validate image MIME types for vision calls
    const supportedMime = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!supportedMime.some(m => mimeType.startsWith(m.split("/")[1]) || mimeType === m)) {
      // Non-image (e.g. video file itself) — skip validation
      return NextResponse.json({ isValid: true, confidence: 0.5, reason: "Video content validated by frame" });
    }

    const response = await client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 200,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageData}` },
            },
            {
              type: "text",
              text: `You are a visual image classifier. Answer these 4 questions about what you literally see in this image, then give a verdict.

Q1: Does biological tissue (pink/red/orange/pale mucosa of the GI tract — stomach, colon, esophagus, or intestine) fill MORE THAN 40% of the total image area? (yes/no)
Q2: Is there a characteristic dark circular or oval vignette border around the image, as produced by an endoscope lens? Answer YES even if the vignette is partial or subtle. Note: esophageal and upper GI endoscopy images often do NOT have a vignette — that is normal and does NOT make them invalid. (yes/no)
Q3: Does the image have a WHITE or LIGHT-COLORED background with text labels, diagram boxes, arrows, or flowchart elements? Answer NO if text appears only on a dark/black background in the corners or edges — such patient metadata overlays (ID, name, date) are a normal part of real clinical endoscopy captures and do NOT make this true. (yes/no)
Q4: Does the image show equipment, devices, monitors, schematics, slides, or screenshots — even partially? (yes/no)

A valid endoscopic image MUST: have Q1=YES AND Q3=NO AND Q4=NO.
Q2 (vignette) is optional — many valid esophageal and gastric endoscopy images lack it.
If Q3 or Q4 is YES, it is NOT a valid endoscopy image regardless of any other content.

Respond with ONLY this JSON (no extra text):
{"q1":true/false,"q2":true/false,"q3":true/false,"q4":true/false,"isEndoscopy":true/false,"confidence":0.0-1.0,"reason":"one sentence in English"}`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

    // Extract JSON even if the model wraps it in text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Parse failed — allow through
      return NextResponse.json({ isValid: true, confidence: 0, reason: "Validation parsing failed" });
    }

    const result = JSON.parse(jsonMatch[0]);

    // Override the model's verdict with our own deterministic logic based on the 4 questions.
    // This prevents the model from soft-overriding the rules when it "recognises" endoscopy content
    // embedded inside a diagram or document.
    let isValid: boolean;
    if (typeof result.q1 === "boolean" &&
        typeof result.q3 === "boolean" && typeof result.q4 === "boolean") {
      // Q1: tissue present (required)
      // Q2: vignette — optional (esophageal/gastric scopes often lack it)
      // Q3: no diagram/flowchart background (required)
      // Q4: no equipment/screenshots (required)
      isValid = result.q1 === true && result.q3 === false && result.q4 === false;
    } else {
      // Fallback: trust the model but only at high confidence
      isValid = (result.isEndoscopy ?? false) && (result.confidence ?? 0) >= 0.75;
    }

    return NextResponse.json({
      isValid,
      confidence: result.confidence ?? 0,
      reason:     result.reason     ?? "",
    });

  } catch (err: any) {
    console.error("[validate-content]", err?.message ?? err);
    // On API error, allow upload (don't block the doctor's workflow)
    return NextResponse.json({ isValid: true, confidence: 0, reason: "Validation unavailable" });
  }
}
