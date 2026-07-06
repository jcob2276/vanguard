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
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || dotenv.SUPABASE_ANON_KEY || dotenv.VITE_SUPABASE_ANON_KEY || "";
}
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || dotenv.SUPABASE_URL || dotenv.VITE_SUPABASE_URL || "";
const ANON_KEY = getAnonKey();
const VANGUARD_USER_ID = process.env.VANGUARD_USER_ID || dotenv.VANGUARD_USER_ID || "";
const LIMIT_DAYS = Number(process.env.BACKTEST_DAYS || 10);

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const OUT_FILE = path.join(__dirname, `backtest_results_${Date.now()}.jsonl`);

async function callOracle(override_date, user_id) {
  const payload = {
    user_id,
    override_date,
    current_query: "Przeanalizuj mój wczorajszy dzień, aktualny stan (z world_state) i powiedz mi, co powinienem zrobić jutro? Podaj konkretną radę na kolejny dzień opartą o faktyczny stan regeneracji i wykonania.",
    mode: "planning",
    agent_run_mode: "auto"
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/vanguard-oracle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || text || `HTTP ${res.status}`);
  return data;
}

async function getAggregates(limit) {
  const queryUrl = `${SUPABASE_URL}/rest/v1/vanguard_daily_aggregates?user_id=eq.${VANGUARD_USER_ID}&order=date.desc&limit=${limit}`;
  const res = await fetch(queryUrl, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) throw new Error("Failed to fetch aggregates");
  return res.json();
}

(async () => {
  try {
    console.log(`🚀 Uruchamiam BACKTEST MÓZGU VANGUARDA (dni: ${LIMIT_DAYS})`);
    const aggs = await getAggregates(LIMIT_DAYS + 1); // +1 to have the "next day" for the last processed day

    if (aggs.length < 2) {
      console.log("Za mało dni w historii by zrobić backtest.");
      process.exit(0);
    }

    // Odwracamy, żeby iść chronologicznie (od najstarszego do najnowszego)
    aggs.reverse();

    let processed = 0;
    
    for (let i = 0; i < aggs.length - 1; i++) {
      const todayAgg = aggs[i];
      const tomorrowAgg = aggs[i+1];
      const dateStr = todayAgg.date;
      
      console.log(`\n⏳ Testuję dzień: ${dateStr}...`);
      
      try {
        const oracleRes = await callOracle(dateStr, VANGUARD_USER_ID);
        
        const resultRow = {
          tested_date: dateStr,
          oracle_advice: oracleRes.response || oracleRes.answer,
          oracle_confidence: oracleRes.confidence,
          actual_tomorrow_date: tomorrowAgg.date,
          actual_tomorrow_score: tomorrowAgg.execution_score,
          actual_tomorrow_sleep: tomorrowAgg.oura_sleep_score,
          actual_tomorrow_strain: tomorrowAgg.total_strain,
          actual_tomorrow_blockers: tomorrowAgg.blockers_notes
        };

        fs.appendFileSync(OUT_FILE, JSON.stringify(resultRow) + "\n");
        console.log(`✅ Otrzymano radę od Oracla. Zapisałem zestawienie.`);
        processed++;
      } catch (err) {
        console.error(`❌ Błąd przy dacie ${dateStr}:`, err.message);
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n🏁 BACKTEST ZAKOŃCZONY. Przeanalizowano ${processed} dni.`);
    console.log(`Wyniki zapisane do: ${OUT_FILE}`);
  } catch (e) {
    console.error("Fatal error:", e);
  }
})();
