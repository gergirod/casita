import { createClient } from "@supabase/supabase-js";

export const STORAGE_BUCKETS = {
  originalBills: "original-bills",
  proofs: "proofs",
  contracts: "contracts",
} as const;

function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Missing Supabase service role env vars.");
  return createClient(url, serviceRoleKey);
}

export async function uploadFileToBucket(input: {
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
  path: string;
  file: Buffer;
  contentType: string;
}) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, input.file, { contentType: input.contentType, upsert: false });

  if (error) throw error;
  return data;
}

export function getPublicUrl(bucket: string, path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
