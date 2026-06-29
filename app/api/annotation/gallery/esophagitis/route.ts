import { NextResponse } from "next/server";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const [imgRes, maskRes] = await Promise.all([
      supabaseAdmin.storage.from(BUCKET).list("esophagitis/images", { limit: 1000, sortBy: { column: "created_at", order: "desc" } }),
      supabaseAdmin.storage.from(BUCKET).list("esophagitis/masks",  { limit: 1000 }),
    ]);

    const imageFiles = (imgRes.data ?? [])
      .filter(f => f.name !== ".emptyFolderPlaceholder" && /\.(jpg|jpeg|png|bmp)$/i.test(f.name));

    const maskSet = new Set(
      (maskRes.data ?? [])
        .filter(f => f.name !== ".emptyFolderPlaceholder")
        .map(f => f.name)
    );

    const items = imageFiles.map(f => {
      const baseName     = f.name.replace(/\.[^.]+$/, "");
      const maskFilename = maskSet.has(`${baseName}.png`) ? `${baseName}.png` : null;
      return { filename: f.name, maskFilename };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
