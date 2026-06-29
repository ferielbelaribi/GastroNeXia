// app/api/upload/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { sanitizeStorageKey } from "@/lib/storageKey";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  const fileName = `${Date.now()}_${sanitizeStorageKey(file.name)}`;

  const { data, error } = await supabase.storage
    .from("uploads")
    .upload(fileName, file);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from("uploads")
    .getPublicUrl(fileName);

  return NextResponse.json({
    url: publicUrlData.publicUrl, // ✅ هذا هو المهم
  });
}