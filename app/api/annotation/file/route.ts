import { NextRequest, NextResponse } from "next/server";
import { storagePublicUrl } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";
  const type = searchParams.get("type") ?? "image";

  // Prevent path traversal
  if (!name || name.includes("..") || /[/\\]/.test(name)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const folder = (searchParams.get("folder") ?? "manual") === "esophagitis"
                 ? "esophagitis" : "manual";
  const subdir = type === "mask" ? "masks" : "images";

  // Redirect to Supabase public URL — no proxying needed
  const url = storagePublicUrl(`${folder}/${subdir}/${name}`);
  return NextResponse.redirect(url, { status: 302 });
}
