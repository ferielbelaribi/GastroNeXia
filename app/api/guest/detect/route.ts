import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GUEST_LIMIT = 3;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const aiServer = process.env.AI_SERVER_URL ?? "http://localhost:8000";

    const aiForm = new FormData();
    aiForm.append("file", file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let aiRes: Response;
    try {
      aiRes = await fetch(`${aiServer}/detect`, { method: "POST", body: aiForm, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      return NextResponse.json({ error: (err as any).detail ?? "AI detection failed" }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const rawDets: any[] = aiData.detections ?? [];

    const detections = rawDets.map((d: any, i: number) => ({
      id:           i,
      label:        d.label        ?? "Finding",
      confidence:   Math.round(d.confidence ?? 0),
      severity:     d.severity     ?? "low",
      location:     d.location     ?? "",
      x:            d.bbox?.x      ?? d.bbox?.x1 ?? 0,
      y:            d.bbox?.y      ?? d.bbox?.y1 ?? 0,
      w:            d.bbox?.w      ?? (d.bbox?.x2 - d.bbox?.x1) ?? 0,
      h:            d.bbox?.h      ?? (d.bbox?.y2 - d.bbox?.y1) ?? 0,
      gradcamBase64: d.gradcamBase64 ?? null,
    }));

    return NextResponse.json({
      detections,
      overallRisk:  aiData.overallRisk  ?? "low",
      modelVersion: aiData.modelVersion ?? "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Detection failed" }, { status: 500 });
  }
}
