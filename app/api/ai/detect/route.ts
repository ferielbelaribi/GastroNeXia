import { NextRequest, NextResponse } from "next/server";

const AI_SERVER = process.env.AI_SERVER_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const upstream = new FormData();
    upstream.append("file", file);

    const res = await fetch(`${AI_SERVER}/detect`, { method: "POST", body: upstream });
    if (!res.ok) return NextResponse.json({ detections: [] });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ detections: [] });
  }
}
