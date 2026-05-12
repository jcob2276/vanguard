import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || "";
const AUTHORIZED_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.message || payload.edited_message;
    if (!message || !message.text) return new Response("OK", { status: 200 });

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const text = message.text;

    // 1. Zabezpieczenie: Tylko Jakub
    if (chatId !== AUTHORIZED_CHAT_ID) {
      return new Response("OK", { status: 200 });
    }

    // 2. NATYCHMIASTOWY ACK — zatrzymuje Telegram retries
    // Cała reszta leci w tle. Oracle zajmuje 30-60s, bez tego timeout.
    EdgeRuntime.waitUntil((async () => {
      try {
        // 3. Idempotencja — jeśli check się wywali, przepuszczamy (nie blokujemy)
        try {
          const { data: existing } = await supabase
            .from('vanguard_stream')
            .select('id')
            .eq('metadata->>telegram_message_id', messageId.toString())
            .maybeSingle();
          if (existing) {
            console.log(`Duplicate: ${messageId}`);
            return;
          }
        } catch (dedupErr) {
          console.warn(`Dedup check failed (non-fatal): ${dedupErr}`);
        }

        // 4. Parsowanie prefiksu
        let shouldRespond = false;
        let mode = 'stream';
        let cleanText = text;

        if (text.startsWith('?'))       { shouldRespond = true; mode = 'chat';    cleanText = text.substring(1).trim(); }
        else if (text.startsWith('!!')) { shouldRespond = true; mode = 'deep';    cleanText = text.substring(2).trim(); }
        else if (text.startsWith('##')) { shouldRespond = false; mode = 'knowledge'; cleanText = text.substring(2).trim(); }
        else if (text.startsWith('@'))  { shouldRespond = true; mode = 'report';  cleanText = text.substring(1).trim(); }

        // 5. Zapis do bazy
        if (mode === 'knowledge') {
          await supabase.from('vanguard_knowledge').insert({
            user_id: VANGUARD_USER_ID,
            title: cleanText.substring(0, 50),
            content: cleanText,
            category: 'lesson',
            importance_score: 10,
            source_type: 'TELEGRAM',
            metadata: { telegram_message_id: messageId }
          });
        } else {
          await supabase.from('vanguard_stream').insert({
            user_id: VANGUARD_USER_ID,
            source: 'telegram',
            content: cleanText,
            metadata: { telegram_chat_id: chatId, telegram_message_id: messageId, mode }
          });
        }

        // 6. Odpowiedź
        let responseText = "";
        if (!shouldRespond) {
          responseText = mode === 'knowledge' ? '📖 Zapisano w Wiedzy.' : '💭 Zapisano w Strumieniu.';
        } else {
          // Typing indicator
          fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action: "typing" })
          }).catch(() => {});

          // Oracle — główny mózg
          const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
            body: {
              current_query: cleanText,
              user_id: VANGUARD_USER_ID,
              mode: mode === 'report' ? 'mirror' : 'chat',
              thinking: mode === 'deep', // !! = think_high, ? = non_think
              history: []
            }
          });

          if (error) {
            responseText = `⚠️ Oracle error: ${error.message}`;
          } else if (!data?.text) {
            responseText = "⚠️ Oracle zwrócił pustą odpowiedź.";
          } else {
            // Usuń tagi <think>...</think> z DeepSeek reasoning mode
            let raw = data.text as string;
            raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            // Telegram limit: 4096 znaków
            responseText = raw.length > 4000 ? raw.substring(0, 4000) + '…' : raw;
            // Sync do historii czatu w aplikacji
            try {
              await supabase.from('ai_chat_messages').insert([
                { user_id: VANGUARD_USER_ID, role: 'user', content: cleanText },
                { user_id: VANGUARD_USER_ID, role: 'assistant', content: responseText }
              ]);
            } catch (_) { /* non-fatal */ }
          }
        }

        // 7. Wyślij odpowiedź
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: responseText,
            disable_notification: !shouldRespond
          })
        });

      } catch (innerErr) {
        console.error("Background error:", innerErr);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: `⚠️ Błąd: ${innerErr.message}` })
        }).catch(() => {});
      }
    })());

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Parse error:", err);
    return new Response("OK", { status: 200 });
  }
});



