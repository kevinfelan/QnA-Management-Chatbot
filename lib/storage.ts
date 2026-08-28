import { createAdminSupabase } from "./supabase-admin";

const BUCKET = "properti-media";

let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;

  const supabase = createAdminSupabase();
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(`Gagal cek bucket storage: ${error.message}`);
  }

  const exists = buckets?.some((b) => b.name === BUCKET);

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
    });
    if (createError) {
      throw new Error(`Gagal membuat bucket storage: ${createError.message}`);
    }
  }

  bucketEnsured = true;
}

export async function uploadFileToStorage(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ path: string; url: string }> {
  await ensureBucket();

  const supabase = createAdminSupabase();
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Gagal upload file: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { path, url: data.publicUrl };
}
