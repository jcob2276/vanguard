/**
 * aw-daily-sync.cjs — ActivityWatch → Supabase daily summary sync
 *
 * USAGE:
 *   node scripts/aw-daily-sync.cjs              # dzisiaj
 *   node scripts/aw-daily-sync.cjs --days=30    # ostatnie 30 dni (backfill)
 *
 * Task Scheduler: uruchamiać raz dziennie o 21:00
 */

const http = require('http');
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

const AW_URL = 'http://localhost:5600';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.VANGUARD_USER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !USER_ID) {
  console.error('Uzupelnij w .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY i VANGUARD_USER_ID');
  process.exit(1);
}

// ── Produktywność: klasyfikacja aplikacji i domen ─────────────────────────────

const WORK_APPS = ['cursor.exe', 'code.exe', 'claude.exe', 'codex.exe', 'windsurf.exe',
  'node.exe', 'python.exe', 'webstorm64.exe', 'idea64.exe', 'pycharm64.exe',
  'terminal', 'powershell', 'cmd.exe', 'wt.exe', 'windowsterminal.exe'];

const WORK_DOMAINS = ['github.com', 'gitlab.com', 'stackoverflow.com', 'supabase.com',
  'claude.ai', 'anthropic.com', 'vercel.com', 'linear.app', 'notion.so',
  'figma.com', 'docs.google.com', 'console.aws.amazon.com'];

const ENTERTAINMENT_APPS = ['vlc.exe', 'spotify.exe', 'steam.exe', 'epicgameslauncher.exe'];

const ENTERTAINMENT_DOMAINS = ['youtube.com', 'netflix.com', 'twitch.tv', 'reddit.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
  'wykop.pl', '9gag.com', 'primevideo.com'];

function classifyApp(app) {
  const a = app.toLowerCase();
  if (WORK_APPS.some(w => a.includes(w.replace('.exe', '')))) return 'work';
  if (ENTERTAINMENT_APPS.some(w => a.includes(w.replace('.exe', '')))) return 'entertainment';
  return 'other';
}

function classifyDomain(domain) {
  const d = domain.toLowerCase();
  if (WORK_DOMAINS.some(w => d.includes(w))) return 'work';
  if (ENTERTAINMENT_DOMAINS.some(w => d.includes(w))) return 'entertainment';
  return 'other';
}

function extractDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return null; }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error(`Bad JSON: ${data.slice(0,100)}`)); } });
    }).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port,
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

function toWarsaw(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

function warsawHour(isoTimestamp) {
  return parseInt(new Date(isoTimestamp).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }));
}

function findBucket(buckets, keyword) {
  return Object.keys(buckets).find(k => k.toLowerCase().includes(keyword)) || null;
}

async function getEvents(bucketId, start, end) {
  const url = `${AW_URL}/api/0/buckets/${bucketId}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=10000`;
  return await httpGet(url);
}

// ── Sync jednego dnia ─────────────────────────────────────────────────────────

async function syncDay(buckets, dateStr) {
  const start = `${dateStr}T00:00:00`;
  const end   = `${dateStr}T23:59:59`;

  const windowBucket = findBucket(buckets, 'window');
  const afkBucket    = findBucket(buckets, 'afk');
  const webBucket    = findBucket(buckets, 'web');
  if (!windowBucket) return null;

  // ── Window events ──
  let windowEvents = [];
  try { windowEvents = await getEvents(windowBucket, start, end); } catch { return null; }
  if (!Array.isArray(windowEvents) || windowEvents.length === 0) return null;

  // ── AFK — not-afk intervals ──
  let notAfkIntervals = null;
  let totalAfkSeconds = 0;
  if (afkBucket) {
    try {
      const afkEvents = await getEvents(afkBucket, start, end);
      totalAfkSeconds = Math.round(afkEvents.filter(e => e.data?.status === 'afk').reduce((s, e) => s + e.duration, 0));
      notAfkIntervals = afkEvents
        .filter(e => e.data?.status === 'not-afk')
        .map(e => ({ start: new Date(e.timestamp), end: new Date(new Date(e.timestamp).getTime() + e.duration * 1000) }));
    } catch {}
  }

  // Filtruj przez not-afk
  const activeEvents = notAfkIntervals
    ? windowEvents.filter(e => { const t = new Date(e.timestamp); return notAfkIntervals.some(i => t >= i.start && t < i.end); })
    : windowEvents;

  if (activeEvents.length === 0) return null;

  // ── 1. Top apps ──
  const appMap = {};
  for (const e of activeEvents) {
    const app = e.data?.app || 'Unknown';
    appMap[app] = (appMap[app] || 0) + e.duration;
  }
  const totalActiveSeconds = Math.round(Object.values(appMap).reduce((s, v) => s + v, 0));
  const topApps = Object.entries(appMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([app, seconds]) => ({ app, seconds: Math.round(seconds) }));

  // ── 2. Pory dnia (Warsaw time) ──
  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const e of activeEvents) {
    const h = warsawHour(e.timestamp);
    if (h >= 6 && h < 12)       timeSlots.morning   += e.duration;
    else if (h >= 12 && h < 18) timeSlots.afternoon += e.duration;
    else if (h >= 18 && h < 24) timeSlots.evening   += e.duration;
    else                         timeSlots.night     += e.duration;
  }
  const timeOfDay = {
    morning:   Math.round(timeSlots.morning / 60),
    afternoon: Math.round(timeSlots.afternoon / 60),
    evening:   Math.round(timeSlots.evening / 60),
    night:     Math.round(timeSlots.night / 60),
  };

  // ── 3. Produktywność (apps) ──
  let workSeconds = 0, entertainmentSeconds = 0;
  for (const [app, secs] of Object.entries(appMap)) {
    const cls = classifyApp(app);
    if (cls === 'work') workSeconds += secs;
    else if (cls === 'entertainment') entertainmentSeconds += secs;
  }

  // ── 4. Web domains ──
  let webDomains = null;
  if (webBucket) {
    try {
      const webEvents = await getEvents(webBucket, start, end);
      if (Array.isArray(webEvents) && webEvents.length > 0) {
        const domainMap = {};
        for (const e of webEvents) {
          const domain = extractDomain(e.data?.url || '');
          if (!domain) continue;
          domainMap[domain] = (domainMap[domain] || 0) + e.duration;
          const cls = classifyDomain(domain);
          if (cls === 'work') workSeconds += e.duration;
          else if (cls === 'entertainment') entertainmentSeconds += e.duration;
        }
        webDomains = Object.entries(domainMap)
          .sort((a, b) => b[1] - a[1]).slice(0, 20)
          .map(([domain, seconds]) => ({ domain, seconds: Math.round(seconds) }));
      }
    } catch {}
  }

  // ── Productivity ratio ──
  const productivityRatio = totalActiveSeconds > 0
    ? parseFloat((workSeconds / totalActiveSeconds).toFixed(3))
    : null;

  // ── Zapis ──
  const res = await httpPost(
    `${SUPABASE_URL}/rest/v1/aw_daily_summary`,
    {
      user_id: USER_ID,
      date: dateStr,
      total_active_seconds: totalActiveSeconds || null,
      total_afk_seconds: totalAfkSeconds || null,
      top_apps: topApps.length ? topApps : null,
      web_domains: webDomains,
      time_of_day: timeOfDay,
      productivity_ratio: productivityRatio,
      categories: null,
    },
    { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'resolution=merge-duplicates' }
  );

  return { dateStr, totalActiveSeconds, topApp: topApps[0]?.app, productivityRatio, saved: res.status < 300 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const daysArg = process.argv.find(a => a.startsWith('--days='));
  const daysBack = daysArg ? parseInt(daysArg.split('=')[1]) : 1;

  console.log(`🤖 AW Daily Sync — ${daysBack === 1 ? 'dzisiaj' : `ostatnie ${daysBack} dni`}`);

  let buckets;
  try {
    buckets = await httpGet(`${AW_URL}/api/0/buckets/`);
    console.log(`🪣 Buckety: ${Object.keys(buckets).join(', ')}`);
  } catch {
    console.error('❌ ActivityWatch nie odpowiada na porcie 5600.');
    process.exit(1);
  }

  const now = new Date();
  let synced = 0, skipped = 0;

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = toWarsaw(d);
    process.stdout.write(`📅 ${dateStr} ... `);

    try {
      const result = await syncDay(buckets, dateStr);
      if (!result) {
        console.log('(brak danych)');
        skipped++;
      } else {
        const mins = Math.round(result.totalActiveSeconds / 60);
        const pct = result.productivityRatio != null ? ` | praca: ${Math.round(result.productivityRatio * 100)}%` : '';
        console.log(`✅ ${mins} min aktywnych | top: ${result.topApp || '—'}${pct}`);
        synced++;
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }

    if (daysBack > 1 && i < daysBack - 1) await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n✅ Gotowe: ${synced} dni zapisano, ${skipped} dni bez danych`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
