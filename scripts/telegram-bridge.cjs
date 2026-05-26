/**
 * telegram-bridge.cjs — legacy long-polling bridge (pre-webhook era)
 *
 * STATUS: DEPRECATED — replaced by the vanguard-telegram Edge Function webhook.
 * Kept only as a local fallback / dev tool.
 *
 * USAGE (never commit live credentials):
 *   TELEGRAM_TOKEN=xxx SUPABASE_KEY=yyy node scripts/telegram-bridge.cjs
 *
 * Required env vars:
 *   TELEGRAM_TOKEN        — bot token from BotFather
 *   SUPABASE_URL          — project URL (defaults below are safe non-secret)
 *   SUPABASE_KEY          — anon/service key
 *   VANGUARD_USER_ID      — UUID of the Vanguard user
 */

const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SUPABASE_URL   = process.env.SUPABASE_URL   || "https://pdvqkgfsqziqlhptatgf.supabase.co";
const SUPABASE_KEY   = process.env.SUPABASE_KEY;
const USER_ID        = process.env.VANGUARD_USER_ID || "165ae341-670c-46ce-82dc-434c4dbfcdfd";

if (!TELEGRAM_TOKEN || !SUPABASE_KEY) {
  console.error("❌  Missing env vars: TELEGRAM_TOKEN and SUPABASE_KEY are required.");
  console.error("    Run: TELEGRAM_TOKEN=xxx SUPABASE_KEY=yyy node scripts/telegram-bridge.cjs");
  process.exit(1);
}

let lastUpdateId = 0;

console.log("🚀 Vanguard Telegram Bridge START...");
console.log("Listening for messages...");

function pollTelegram() {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;

  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', async () => {
      try {
        const json = JSON.parse(data);
        if (json.ok && json.result.length > 0) {
          for (const update of json.result) {
            lastUpdateId = update.update_id;
            const message = update.message;

            if (message && message.text) {
              console.log(`📩 New thought: "${message.text}"`);
              await saveToSupabase(message.text, message.chat.id);
              sendConfirmation(message.chat.id);
            }
          }
        }
        pollTelegram();
      } catch (e) {
        console.error("Polling Error:", e.message);
        setTimeout(pollTelegram, 5000);
      }
    });
  }).on('error', (err) => {
    console.error("Network Error:", err.message);
    setTimeout(pollTelegram, 5000);
  });
}

async function saveToSupabase(content, chatId) {
  const body = JSON.stringify({
    user_id: USER_ID,
    source: 'telegram',
    content: content,
    metadata: { telegram_chat_id: chatId }
  });

  return new Promise((resolve) => {
    const req = https.request(`${SUPABASE_URL}/rest/v1/vanguard_stream`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, () => resolve());
    req.on('error', (e) => console.error("Supabase Error:", e.message));
    req.write(body);
    req.end();
  });
}

function sendConfirmation(chatId) {
  const body = JSON.stringify({
    chat_id: chatId,
    text: "🧠 Myśl zsynchronizowana z Vanguardem."
  });

  const req = https.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  req.write(body);
  req.end();
}

pollTelegram();
