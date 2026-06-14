import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readEnvFile() {
  try {
    const envPath = path.resolve(__dirname, "../../.env");
    if (fs.existsSync(envPath)) {
      const result = {};
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(["']?)(.*?)\2\s*$/);
        if (match) result[match[1]] = match[3];
      }
      return result;
    }
  } catch { /* no-op */ }
  return {};
}

const dotenv = readEnvFile();

function getAnonKey() {
  return process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || dotenv.SUPABASE_ANON_KEY
    || dotenv.VITE_SUPABASE_ANON_KEY
    || "";
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  || dotenv.SUPABASE_URL || dotenv.VITE_SUPABASE_URL || "";
const ANON_KEY = getAnonKey();
const VANGUARD_USER_ID = process.env.VANGUARD_USER_ID || dotenv.VANGUARD_USER_ID || "";
const BATCH_SIZE = Number(process.env.EVAL_BATCH_SIZE || dotenv.EVAL_BATCH_SIZE || 4);

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}
// const BATCH_WAIT_MS = 95000; // 95s — batch potrzebuje ~80-90s, czekamy aż skończy (unused)

async function callRunner(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/vanguard-eval-runner`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || text || `HTTP ${res.status}`);
  return data;
}

async function getStatus(run_id) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/vanguard-eval-runner`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ action: "status", run_id })
  });
  return res.json();
}

function renderProgress(data, total_q = 60) {
  const run = data.run || {};
  const done = data.results_count || 0;
  const passed = data.passed || 0;
  const avgScore = data.avg_score != null ? data.avg_score.toFixed(2) : "—";
  const byCategory = data.by_category || run?.summary?.by_category || {};

  const BAR_LEN = 30;
  const filled = Math.round((done / total_q) * BAR_LEN);
  const bar = "█".repeat(filled) + "░".repeat(BAR_LEN - filled);

  console.clear();
  console.log("═══════════════════════════════════════");
  console.log("       VANGUARD EVAL — POSTĘP          ");
  console.log("═══════════════════════════════════════");
  console.log(`Status:    ${run?.status === 'completed' ? '✅ completed' : run?.status === 'failed' ? '❌ failed' : '⏳ running'}`);
  console.log(`Pytania:   [${bar}] ${done}/${total_q}`);
  console.log(`Zaliczone: ${passed}/${done} (${done > 0 ? Math.round(passed/done*100) : 0}%)`);
  console.log(`Śr. score: ${avgScore}`);
  console.log("───────────────────────────────────────");

  if (Object.keys(byCategory).length > 0) {
    console.log("Wyniki per kategoria (live):");
    for (const [cat, d] of Object.entries(byCategory)) {
      const pct = d.total > 0 ? Math.round(d.passed / d.total * 100) : 0;
      const bar2 = "█".repeat(Math.round(pct/10)) + "░".repeat(10 - Math.round(pct/10));
      console.log(`  ${cat.padEnd(22)} [${bar2}] ${d.passed}/${d.total} (${pct}%)`);
    }
  }
  console.log("═══════════════════════════════════════");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForBatch(run_id, expected_min, timeout_ms = 100000) {
  const start = Date.now();
  while (Date.now() - start < timeout_ms) {
    const status = await getStatus(run_id).catch(() => null);
    if (status) {
      renderProgress(status);
      if (status.run?.status === 'failed') throw new Error(`Run failed: ${JSON.stringify(status.run.summary || {})}`);
      if ((status.results_count || 0) >= expected_min) return status;
      if (status.run?.status === 'completed') return status;
    }
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for batch to reach ${expected_min} results`);
}

(async () => {
  try {
    console.log("🚀 Uruchamiam eval (batch mode)...");

    // Batch 0 — tworzy nowy run
    const first = await callRunner({ batch_size: BATCH_SIZE, user_id: VANGUARD_USER_ID || undefined });
    if (!first.run_id) throw new Error("Brak run_id: " + JSON.stringify(first));
    const run_id = first.run_id;
    const total = first.total;
    console.log(`✅ Run: ${run_id} | ${total} pytań | batch size: ${BATCH_SIZE}`);

    let offset = first.offset_next;
    let finished = first.finished;

    // Czekaj aż pierwszy batch dobiegnie
    console.log(`\n⏳ Batch 1/${Math.ceil(total/BATCH_SIZE)} (pytania 1–${BATCH_SIZE})...`);
    await waitForBatch(run_id, BATCH_SIZE);

    // Łańcuchuj kolejne batche
    while (!finished) {
      console.log(`\n🔄 Uruchamiam batch offset=${offset}...`);
      const batchRes = await callRunner({ run_id, offset, batch_size: BATCH_SIZE, user_id: VANGUARD_USER_ID || undefined });
      if (batchRes.error) throw new Error("Batch error: " + batchRes.error);
      finished = batchRes.finished;
      const expected = batchRes.offset_next;
      console.log(`⏳ Batch ${offset}–${expected - 1} z ${total}...`);
      await waitForBatch(run_id, expected);
      offset = expected;
    }

    // Końcowy raport
    const final = await getStatus(run_id);
    renderProgress(final, total);
    if (final.run?.status !== 'completed') {
      throw new Error(`Eval did not complete cleanly: ${JSON.stringify(final.run || {})}`);
    }

    if (final.run?.status === 'completed' && final.run?.summary) {
      const s = final.run.summary;
      console.log("\n🏁 EVAL ZAKOŃCZONY!");
      console.log(`📊 Pass rate: ${(s.pass_rate * 100).toFixed(1)}%`);
      console.log(`📊 Avg score: ${s.avg_score}`);
      console.log(`📊 Sędzia:    ${s.judge_model}`);
      if (s.by_category) {
        console.log("\nWyniki per kategoria (final):");
        for (const [cat, d] of Object.entries(s.by_category)) {
          const pct = d.total > 0 ? Math.round(d.passed / d.total * 100) : 0;
          console.log(`  ${cat.padEnd(24)} ${d.passed}/${d.total} (${pct}%) avg:${d.avg_score}`);
        }
      }
    }

  } catch (err) {
    console.error("❌ Błąd:", err.message);
  }
})();
