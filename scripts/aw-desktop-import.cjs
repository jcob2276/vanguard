/**
 * aw-desktop-import.cjs — Import historii ActivityWatch z desktop export JSON
 *
 * USAGE:
 *   node scripts/aw-desktop-import.cjs "C:\Users\jakub\Downloads\aw-buckets-export.json"
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pdvqkgfsqziqlhptatgf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.VANGUARD_USER_ID;

const filePath = process.argv[2];
if (!filePath) { console.error('❌ Podaj ścieżkę do pliku eksportu'); process.exit(1); }
if (!SUPABASE_KEY || !USER_ID) { console.error('❌ Brak SUPABASE_SERVICE_ROLE_KEY / VANGUARD_USER_ID w .env'); process.exit(1); }

// ── Klasyfikacja (identyczna jak w live sync) ─────────────────────────────────

const WORK_APPS = ['cursor', 'code', 'claude', 'codex', 'windsurf', 'node', 'python',
  'webstorm', 'idea', 'pycharm', 'terminal', 'powershell', 'cmd', 'wt', 'windowsterminal'];
const WORK_DOMAINS = ['github.com', 'gitlab.com', 'stackoverflow.com', 'supabase.com',
  'claude.ai', 'anthropic.com', 'vercel.com', 'linear.app', 'notion.so',
  'figma.com', 'docs.google.com', 'console.aws.amazon.com'];
const ENTERTAINMENT_DOMAINS = ['youtube.com', 'netflix.com', 'twitch.tv', 'reddit.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
  'wykop.pl', '9gag.com', 'primevideo.com'];

function classifyApp(app) {
  const a = app.toLowerCase();
  return WORK_APPS.some(w => a.includes(w)) ? 'work' : 'other';
}
function classifyDomain(domain) {
  const d = domain.toLowerCase();
  if (WORK_DOMAINS.some(w => d.includes(w))) return 'work';
  if (ENTERTAINMENT_DOMAINS.some(w => d.includes(w))) return 'entertainment';
  return 'other';
}
function extractDomain(url) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return null; }
}
function toWarsawDate(ts) { return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }); }
function warsawHour(ts) { return parseInt(new Date(ts).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false })); }

// ── HTTP ──────────────────────────────────────────────────────────────────────

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname, port: 443,
      path: parsed.pathname + parsed.search, method: 'POST',
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

// ── Przetwarzanie ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`🖥️  AW Desktop Import — wczytuję: ${filePath}`);

  let exportData;
  try { exportData = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error(`❌ Błąd odczytu: ${e.message}`); process.exit(1); }

  const buckets = exportData.buckets || {};
  const ids = Object.keys(buckets);
  console.log(`🪣 Buckety: ${ids.join(', ')}\n`);

  // Znajdź buckety
  const windowId = ids.find(k => k.toLowerCase().includes('window'));
  const afkId    = ids.find(k => k.toLowerCase().includes('afk'));
  const webId    = ids.find(k => k.toLowerCase().includes('web'));

  if (!windowId) { console.error('❌ Brak bucketu window w eksporcie'); process.exit(1); }
  console.log(`  Window: ${windowId}`);
  console.log(`  AFK:    ${afkId || 'brak'}`);
  console.log(`  Web:    ${webId || 'brak'}\n`);

  const windowEvents = buckets[windowId]?.events || [];
  const afkEvents    = afkId ? (buckets[afkId]?.events || []) : [];
  const webEvents    = webId ? (buckets[webId]?.events || []) : [];

  console.log(`📊 Eventów — window: ${windowEvents.length}, afk: ${afkEvents.length}, web: ${webEvents.length}`);

  // Grupuj AFK not-afk po dniach
  const notAfkByDay = {};
  for (const e of afkEvents) {
    if (e.data?.status !== 'not-afk') continue;
    const date = toWarsawDate(e.timestamp);
    if (!notAfkByDay[date]) notAfkByDay[date] = [];
    const s = new Date(e.timestamp);
    const en = new Date(s.getTime() + e.duration * 1000);
    notAfkByDay[date].push({ start: s, end: en });
  }

  // Grupuj window events po dniach
  const windowByDay = {};
  for (const e of windowEvents) {
    const date = toWarsawDate(e.timestamp);
    if (!windowByDay[date]) windowByDay[date] = [];
    windowByDay[date].push(e);
  }

  // Grupuj web events po dniach
  const webByDay = {};
  for (const e of webEvents) {
    const date = toWarsawDate(e.timestamp);
    if (!webByDay[date]) webByDay[date] = [];
    webByDay[date].push(e);
  }

  const allDates = [...new Set([...Object.keys(windowByDay)])].sort().reverse();
  console.log(`📅 Dni z danymi: ${allDates.length} (${allDates[allDates.length-1]} → ${allDates[0]})\n`);

  let saved = 0;
  for (const date of allDates) {
    const dayWindowEvents = windowByDay[date] || [];
    const notAfkIntervals = notAfkByDay[date] || null;

    // Filtruj przez not-afk
    const activeEvents = notAfkIntervals && notAfkIntervals.length > 0
      ? dayWindowEvents.filter(e => { const t = new Date(e.timestamp); return notAfkIntervals.some(i => t >= i.start && t < i.end); })
      : dayWindowEvents;

    if (activeEvents.length === 0) { console.log(`📅 ${date} ... (brak aktywnych eventów)`); continue; }

    // Top apps
    const appMap = {};
    for (const e of activeEvents) {
      const app = e.data?.app || 'Unknown';
      appMap[app] = (appMap[app] || 0) + e.duration;
    }
    const totalActiveSeconds = Math.round(Object.values(appMap).reduce((s, v) => s + v, 0));
    const topApps = Object.entries(appMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([app, seconds]) => ({ app, seconds: Math.round(seconds) }));

    // Pory dnia
    const slots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const e of activeEvents) {
      const h = warsawHour(e.timestamp);
      if (h >= 6 && h < 12) slots.morning += e.duration;
      else if (h >= 12 && h < 18) slots.afternoon += e.duration;
      else if (h >= 18 && h < 24) slots.evening += e.duration;
      else slots.night += e.duration;
    }
    const timeOfDay = { morning: Math.round(slots.morning/60), afternoon: Math.round(slots.afternoon/60), evening: Math.round(slots.evening/60), night: Math.round(slots.night/60) };

    // Web domains
    let webDomains = null;
    let workSeconds = 0;
    for (const [app, secs] of Object.entries(appMap)) {
      if (classifyApp(app) === 'work') workSeconds += secs;
    }
    const dayWebEvents = webByDay[date] || [];
    if (dayWebEvents.length > 0) {
      const domainMap = {};
      for (const e of dayWebEvents) {
        const domain = extractDomain(e.data?.url || '');
        if (!domain) continue;
        domainMap[domain] = (domainMap[domain] || 0) + e.duration;
        if (classifyDomain(domain) === 'work') workSeconds += e.duration;
      }
      webDomains = Object.entries(domainMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([domain, seconds]) => ({ domain, seconds: Math.round(seconds) }));
    }

    const productivityRatio = totalActiveSeconds > 0 ? parseFloat((workSeconds / totalActiveSeconds).toFixed(3)) : null;

    process.stdout.write(`📅 ${date} ... ${Math.round(totalActiveSeconds/60)} min | top: ${topApps[0]?.app} | praca: ${productivityRatio != null ? Math.round(productivityRatio*100)+'%' : '?'} ... `);

    const res = await httpPost(
      `${SUPABASE_URL}/rest/v1/aw_daily_summary?on_conflict=user_id,date`,
      { user_id: USER_ID, date, total_active_seconds: totalActiveSeconds, top_apps: topApps, web_domains: webDomains, time_of_day: timeOfDay, productivity_ratio: productivityRatio },
      { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'resolution=merge-duplicates' }
    );

    if (res.status < 300) { console.log('✅'); saved++; }
    else { console.log(`❌ ${res.status}: ${JSON.stringify(res.body)}`); }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Gotowe: ${saved}/${allDates.length} dni zapisano`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
