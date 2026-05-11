const https = require('https');

const TELEGRAM_TOKEN = "7504183176:AAFAfdQ7oMsjpnjZCz2dCZy-FmnxZVn1pA0";
const SUPABASE_URL = "https://pdvqkgfsqziqlhptatgf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ0NzgsImV4cCI6MjA5Mjk2MDQ3OH0.vM69FS8w1K3N_eJjD7LLYxi59T2xCnMH1STEsAICyqU"; 
const USER_ID = "165ae341-670c-46ce-82dc-434c4dbfcdfd";

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
        pollTelegram(); // Next poll
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
    }, (res) => {
      resolve();
    });
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
