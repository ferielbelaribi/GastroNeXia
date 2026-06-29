import { NextRequest, NextResponse } from "next/server";

const AI_SERVER = process.env.AI_SERVER_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const aiForm = new FormData();
    aiForm.append("file", file);

    const aiRes = await fetch(`${AI_SERVER}/analyze`, {
      method: "POST",
      body: aiForm,
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("FastAPI error:", text);
      return NextResponse.json({ error: "AI server error" }, { status: 500 });
    }

    const data = await aiRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}