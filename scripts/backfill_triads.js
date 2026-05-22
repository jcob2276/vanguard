const URL = "https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-architect";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ0NzgsImV4cCI6MjA5Mjk2MDQ3OH0.vM69FS8w1K3N_eJjD7LLYxi59T2xCnMH1STEsAICyqU";

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
