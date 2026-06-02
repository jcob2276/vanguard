/**
 * aw-phone-import.cjs — Import danych ActivityWatch z telefonu do Supabase
 *
 * USAGE:
 *   node scripts/aw-phone-import.cjs "path/to/aw-buckets-export.json"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Auto-load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.VANGUARD_USER_ID;

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Podaj ścieżkę do pliku: node scripts/aw-phone-import.cjs "ścieżka/do/pliku.json"');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY || !USER_ID) {
  console.error('Uzupelnij SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY i VANGUARD_USER_ID w .env');
  process.exit(1);
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname, port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, (res) => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(out) }); } catch { resolve({ status: res.statusCode, body: out }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function toWarsawDate(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

async function main() {
  console.log(`📱 AW Phone Import — wczytuję: ${filePath}`);

  let exportData;
  try {
    exportData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`❌ Błąd odczytu pliku: ${e.message}`);
    process.exit(1);
  }

  const buckets = exportData.buckets || {};
  const bucketIds = Object.keys(buckets);
  console.log(`🪣 Buckety w pliku: ${bucketIds.join(', ')}`);

  // Zbierz wszystkie eventy ze wszystkich bucketów
  // Pomijaj AFK bucket — interesują nas app/window eventy
  const allEvents = [];
  for (const [bucketId, bucket] of Object.entries(buckets)) {
    if (bucketId.toLowerCase().includes('afk')) continue;
    const events = bucket.events || [];
    for (const e of events) {
      if (!e.timestamp || !e.duration) continue;
      const app = e.data?.app || e.data?.package || e.data?.classname || e.data?.title || 'Unknown';
      allEvents.push({ timestamp: e.timestamp, duration: e.duration, app });
    }
  }

  console.log(`📊 Łącznie eventów: ${allEvents.length}`);

  // Grupuj po dniach (Warsaw time)
  const byDay = {};
  for (const e of allEvents) {
    const date = toWarsawDate(e.timestamp);
    if (!byDay[date]) byDay[date] = {};
    byDay[date][e.app] = (byDay[date][e.app] || 0) + e.duration;
  }

  const dates = Object.keys(byDay).sort().reverse();
  console.log(`📅 Dni z danymi: ${dates.length} (${dates[dates.length-1]} → ${dates[0]})\n`);

  let saved = 0;
  for (const date of dates) {
    const appMap = byDay[date];
    const totalSeconds = Math.round(Object.values(appMap).reduce((s, v) => s + v, 0));
    const topApps = Object.entries(appMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([app, seconds]) => ({ app, seconds: Math.round(seconds) }));

    const mins = Math.round(totalSeconds / 60);
    process.stdout.write(`📅 ${date} ... ${mins} min | top: ${topApps[0]?.app} ... `);

    const res = await httpPost(
      `${SUPABASE_URL}/rest/v1/aw_daily_summary?on_conflict=user_id,date`,
      {
        user_id: USER_ID,
        date,
        phone_active_seconds: totalSeconds,
        phone_top_apps: topApps,
      },
      {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      }
    );

    if (res.status < 300) {
      console.log('✅');
      saved++;
    } else {
      console.log(`❌ ${res.status}: ${JSON.stringify(res.body)}`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Gotowe: ${saved}/${dates.length} dni zapisano`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
