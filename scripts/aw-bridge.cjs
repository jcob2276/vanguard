/**
 * aw-bridge.cjs — ActivityWatch → Supabase sync bridge
 *
 * STATUS: DEPRECATED — ActivityWatch integration no longer active.
 * Kept as local dev tool if needed.
 *
 * USAGE: SUPABASE_KEY=xxx node scripts/aw-bridge.cjs
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pdvqkgfsqziqlhptatgf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error("❌  SUPABASE_KEY env var is required. Run: SUPABASE_KEY=xxx node scripts/aw-bridge.cjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PORT = 5601;
const AW_URL = 'http://localhost:5600';
const SYNC_INTERVAL = 120000; 

async function performSync() {
  console.log('🤖 Robot: Rozpoczynam synchronizację...');
  try {
    const buckets = await new Promise((resolve, reject) => {
      http.get(`${AW_URL}/api/0/buckets/`, (res) => { // Dodano /
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const payload = { window: null, afk: null, web: null };

    for (const [id, _bucket] of Object.entries(buckets)) {
      // Używamy formatu bez ukośnika przed events, jak w testach
      const endpoint = `${AW_URL}/api/0/buckets/${id}/events?limit=1`;
      
      const events = await new Promise((resolve) => {
        http.get(endpoint, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve([]); }
          });
        }).on('error', () => resolve([]));
      });

      if (events[0]) {
        if (id.includes('window')) payload.window = { app: events[0].data.app, title: events[0].data.title };
        if (id.includes('afk')) payload.afk = events[0].data.status;
        if (id.includes('web')) payload.web = { url: events[0].data.url, title: events[0].data.title };
      }
    }

    const { data: userData } = await supabase.from('vanguard_footprint').select('user_id').limit(1);
    const userId = userData?.[0]?.user_id;

    if (userId && (payload.window || payload.afk)) {
      const { error } = await supabase.from('vanguard_footprint').insert({
        user_id: userId,
        category: 'activitywatch_v2',
        payload: payload
      });
      if (!error) console.log(`✅ Robot: Zsynchronizowano (${payload.window?.title || 'brak okna'})`);
      else console.error('❌ Robot Error:', error.message);
    }
  } catch (err) {
    console.error('❌ Robot Critical Error:', err.message);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const targetUrl = AW_URL + req.url.split('?')[0];
  http.get(targetUrl, (awRes) => {
    let data = '';
    awRes.on('data', chunk => data += chunk);
    awRes.on('end', () => {
      res.writeHead(awRes.statusCode, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Niewidzialny Obserwator (V2) na porcie ${PORT}`);
  setInterval(performSync, SYNC_INTERVAL);
  performSync();
});
