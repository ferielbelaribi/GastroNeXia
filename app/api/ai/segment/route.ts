// app/api/ai/segment/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file);

  // Forward YOLO boxes if provided (enables ROI-guided segmentation)
  const boxes = formData.get("boxes");
  if (boxes) upstream.append("boxes", boxes as string);

  let res: Response;
  try {
    res = await fetch(
      `${process.env.AI_SERVER_URL ?? "http://localhost:8000"}/segment`,
      { method: "POST", body: upstream }
    );
  } catch {
    return NextResponse.json(
      { error: "AI server unreachable" },
      { status: 503 }
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as any).detail ?? "Segmentation failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(await res.json());
}