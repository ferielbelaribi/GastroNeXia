import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const BUCKET = "annotations";

/** Public URL for a file inside the annotations bucket */
export function storagePublicUrl(storagePath: string): string {
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Ensure the bucket exists (call once at startup / lazily) */
let _bucketReady = false;
export async function ensureBucket() {
  if (_bucketReady) return;
  const { data: list } = await supabaseAdmin.storage.listBuckets();
  const exists = list?.some(b => b.name === BUCKET);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  }
  _bucketReady = true;
}
