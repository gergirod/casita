import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

// Parse .env.local manually
const env = {};
readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKETS = ["original-bills", "contracts", "proofs"];

for (const bucket of BUCKETS) {
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
  if (error) { console.log(`[${bucket}] list error:`, error.message); continue; }
  if (!data?.length) { console.log(`[${bucket}] already empty`); continue; }
  const paths = data.map((f) => f.name);
  const { error: delErr } = await supabase.storage.from(bucket).remove(paths);
  if (delErr) console.log(`[${bucket}] delete error:`, delErr.message);
  else console.log(`[${bucket}] deleted ${paths.length} file(s)`);
}

console.log("Done.");
