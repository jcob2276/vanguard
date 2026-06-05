/**
 * aw-phone-import.cjs — Import ActivityWatch (telefon) → phone_usage_daily
 *
 * USAGE:
 *   node scripts/aw-phone-import.cjs "path/to/aw-buckets-export.json"
 *
 * Kalkuluje duration z różnicy timestampów (AW mobile ma duration: 0).
 * Kategoryzuje aplikacje: social, messaging, entertainment, AI, browser.
 * Liczy late_night_minutes (23:00–04:00 Warsaw) i odblokowania ekranu.
 */

const https = require('https');
const fs   = require('fs');
const path = require('path');

// --- .env ---------------------------------------------------------------
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=');
    if (k && rest.length && !process.env[k.trim()])
      process.env[k.trim()] = rest.join('=').trim();
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID      = process.env.VANGUARD_USER_ID;
const FILE         = process.argv[2];

if (!FILE)            { console.error('❌ Podaj ścieżkę do pliku JSON'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY || !USER_ID)
  { console.error('❌ Uzupełnij SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VANGUARD_USER_ID w .env'); process.exit(1); }

// --- Kategorie ----------------------------------------------------------
const CATEGORIES = {
  social:        ['musically', 'tiktok', 'twitter', 'xmobile', 'instagram', 'badoo', 'snapchat', 'pinterest'],
  messaging:     ['orca', 'telegram', 'whatsapp', 'viber', 'signal'],
  entertainment: ['youtube', 'netflix', 'twitch', 'spotify', 'tidal', 'hbomax', 'prime'],
  ai:            ['chatgpt', 'grok', 'claude', 'perplexity', 'gemini', 'copilot'],
  browser:       ['chrome', 'brave', 'firefox', 'opera', 'edge', 'duckduckgo'],
};

function categorize(pkg = '') {
  const p = pkg.toLowerCase();
  for (const [cat, keys] of Object.entries(CATEGORIES))
    if (keys.some(k => p.includes(k))) return cat;
  return 'inne';
}

function toWarsawDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}
function warsawHour(iso) {
  return parseInt(new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit' }));
}
function isLateNight(iso) {
  const h = warsawHour(iso);
  return h >= 23 || h < 4;
}

// --- HTTP POST ----------------------------------------------------------
function upsert(rows) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${SUPABASE_URL}/rest/v1/phone_usage_daily?on_conflict=user_id,date`);
    const body = JSON.stringify(rows);
    const req = https.request({
      hostname: parsed.hostname, port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      }
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// --- Main ---------------------------------------------------------------
async function main() {
  console.log(`\n📱 AW Phone Import → phone_usage_daily`);
  console.log(`   Plik: ${FILE}\n`);

  const exportData = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const buckets    = exportData.buckets || {};

  // Odblokowania ekranu
  const unlockEvents = (buckets['aw-watcher-android-unlock']?.events || []);
  const unlocksByDay = {};
  for (const e of unlockEvents) {
    const d = toWarsawDate(e.timestamp);
    unlocksByDay[d] = (unlocksByDay[d] || 0) + 1;
  }

  // Eventy aplikacji (currentwindow)
  const appEvents = (buckets['aw-watcher-android-test']?.events || [])
    .filter(e => e.data?.package)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (!appEvents.length) { console.error('❌ Brak eventów aplikacji'); process.exit(1); }
  console.log(`   Eventów aplikacji: ${appEvents.length}`);
  console.log(`   Odblokowań: ${unlockEvents.length}`);

  // Oblicz duration z diff timestamps (max 5 min na gap)
  const MAX_GAP = 300;
  const byDay   = {};

  for (let i = 0; i < appEvents.length; i++) {
    const ev  = appEvents[i];
    const pkg = ev.data.package;
    const app = ev.data.app || pkg;
    const ts  = ev.timestamp;

    let dur = 0;
    if (i + 1 < appEvents.length) {
      const diff = (new Date(appEvents[i+1].timestamp) - new Date(ts)) / 1000;
      dur = Math.min(Math.max(diff, 0), MAX_GAP);
    }
    if (dur <= 0) continue;

    const date = toWarsawDate(ts);
    if (!byDay[date]) byDay[date] = { apps: {}, late: {}, total: 0, late_total: 0 };
    const d = byDay[date];

    d.apps[pkg] = d.apps[pkg] || { app, sec: 0 };
    d.apps[pkg].sec += dur;
    d.total += dur;

    if (isLateNight(ts)) {
      d.late[pkg] = (d.late[pkg] || 0) + dur;
      d.late_total += dur;
    }
  }

  // Buduj wiersze
  const rows = [];
  for (const [date, d] of Object.entries(byDay)) {
    const catSecs = { social: 0, messaging: 0, entertainment: 0, ai: 0, browser: 0 };
    for (const [pkg, info] of Object.entries(d.apps)) {
      const cat = categorize(pkg);
      if (cat !== 'inne') catSecs[cat] += info.sec;
    }

    const topApps = Object.entries(d.apps)
      .sort((a, b) => b[1].sec - a[1].sec)
      .slice(0, 10)
      .map(([pkg, info]) => ({ app: info.app, pkg, min: Math.round(info.sec / 60) }));

    rows.push({
      user_id:               USER_ID,
      date,
      total_minutes:         Math.round(d.total / 60),
      late_night_minutes:    Math.round(d.late_total / 60),
      social_minutes:        Math.round(catSecs.social / 60),
      messaging_minutes:     Math.round(catSecs.messaging / 60),
      entertainment_minutes: Math.round(catSecs.entertainment / 60),
      ai_minutes:            Math.round(catSecs.ai / 60),
      browser_minutes:       Math.round(catSecs.browser / 60),
      unlocks:               unlocksByDay[date] || 0,
      top_apps:              topApps,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`\n📅 Dni do zapisu: ${rows.length} (${rows[0]?.date} → ${rows[rows.length-1]?.date})\n`);

  // Podgląd
  for (const r of rows) {
    const ln = r.late_night_minutes > 60 ? ` 🌙 ${r.late_night_minutes}m` : '';
    const yt = r.top_apps[0];
    console.log(`   ${r.date}  ${r.total_minutes}min  🔓${r.unlocks}  ent:${r.entertainment_minutes}m  soc:${r.social_minutes}m  msg:${r.messaging_minutes}m${ln}  top: ${yt?.app}`);
  }

  // Upsert partiami po 20
  console.log('\n⬆️  Uploading...');
  let ok = 0;
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const res = await upsert(chunk);
    if (res.status < 300) { ok += chunk.length; process.stdout.write('.'); }
    else console.error(`\n❌ ${res.status}: ${res.body.slice(0, 200)}`);
    await new Promise(r => setTimeout(r, 80));
  }
  console.log(`\n\n✅ Gotowe: ${ok}/${rows.length} dni zapisano do phone_usage_daily`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
