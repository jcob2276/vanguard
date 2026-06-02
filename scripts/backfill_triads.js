import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAnonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY;
  try {
    const envPath = path.resolve(__dirname, "../.env");
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf8").split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(["']?)(.*?)\1\s*$/);
        if (match) return match[2];
      }
    }
  } catch { // no-op
  }
  return "";
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/vanguard-architect` : "";
const KEY = getAnonKey();

if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

async function backfill() {
  let offset = 0;
  let totalTriads = 0;
  let totalProcessed = 0;

  console.log("đźš€ Starting Retroactive Backfill for vanguard_stream...");

  while (true) {
    console.log(`đź“¦ Processing batch at offset ${offset}...`);
    try {
      const response = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KEY}`,
          'apikey': KEY
        },
        body: JSON.stringify({ type: 'stream', offset, limit: 10 })
      });

      const data = await response.json();

      if (data.error) {
        console.error(`âťŚ Error at offset ${offset}:`, data.error);
        break;
      }

      if (!data.items_processed || data.items_processed === 0) {
        console.log("đźŹ No more records to process.");
        break;
      }

      totalProcessed += data.items_processed;
      totalTriads += data.triads_created || 0;
      console.log(`âś… Batch complete. Processed: ${data.items_processed}, Triads created: ${data.triads_created || 0}`);

      offset += 10;

      // Safety break to prevent infinite loops if something goes wrong
      if (offset > 5000) {
        console.warn("âš ď¸Ź Safety break triggered at 5000 records.");
        break;
      }
    } catch (err) {
      console.error(`âťŚ Network error at offset ${offset}:`, err.message);
      break;
    }
  }

  console.log("==========================================");
  console.log(`đźŽ‰ BACKFILL COMPLETE`);
  console.log(`Total stream entries processed: ${totalProcessed}`);
  console.log(`Total triads added/updated: ${totalTriads}`);
  console.log("==========================================");
}

backfill();
