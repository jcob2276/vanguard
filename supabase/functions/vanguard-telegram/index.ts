import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || "";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || "";
const AUTHORIZED_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- WHISPER INTEGRATION ---
async function transcribeAudio(fileId: string) {
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("Nie udało się pobrać ścieżki pliku z Telegrama");

    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

    const audioRes = await fetch(fileUrl);
    const audioBlob = await audioRes.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "voice.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pl");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });

    const whisperData = await whisperRes.json();
    if (whisperData.error) throw new Error(`Whisper Error: ${whisperData.error.message}`);

    return whisperData.text;
  } catch (err) {
    console.error("Transcription failed:", err);
    throw err;
  }
}

serve(async (req) => {
  try {
    const payload = await req.json();
    
    if (payload.callback_query) {
      const { id, data, message } = payload.callback_query;
      const chatId = message.chat.id;
      const callbackId = id;
      const isOk = data.startsWith('fb_ok');
      const score = isOk ? 1 : -1;
      
      EdgeRuntime.waitUntil((async () => {
        try {
          await supabase.from('vanguard_feedback').insert({
            user_id: VANGUARD_USER_ID,
            message_id: message.message_id.toString(),
            query: message.reply_to_message?.text || "Unknown",
            reply: message.text,
            score: score,
            metadata: { callback_data: data }
          });

          if (isOk) {
            const { data: lastKnowledge } = await supabase
              .from('vanguard_knowledge')
              .select('id')
              .eq('user_id', VANGUARD_USER_ID)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastKnowledge) {
              await supabase
                .from('vanguard_knowledge')
                .update({ is_verified: true })
                .eq('id', lastKnowledge.id);
            }
          }

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackId,
              text: isOk ? "✅ Przyjęte. Vanguard uczy się..." : "❌ Zanotowano błąd. Napisz poprawkę.",
            })
          });

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: { inline_keyboard: [] }
            })
          });

          if (!isOk) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                chat_id: chatId, 
                text: "📝 Napisz mi teraz: 'Poprawka: [prawdziwa informacja]', abym mógł to zapisać na stałe." 
              })
            });
          }
        } catch (err) {
          console.error("Feedback callback error:", err);
        }
      })());
      
      return new Response("OK", { status: 200 });
    }

    const message = payload.message || payload.edited_message;
    if (!message) return new Response("OK", { status: 200 });

    const isVoice = !!message.voice;
    if (!message.text && !isVoice) return new Response("OK", { status: 200 });

    const chatId = message.chat.id;
    const messageId = message.message_id;
    let text = message.text || "";

    if (chatId !== AUTHORIZED_CHAT_ID) {
      return new Response("OK", { status: 200 });
    }

    EdgeRuntime.waitUntil((async () => {
      try {
        if (isVoice) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: "🎤 Słucham...", disable_notification: true })
          }).catch(() => {});

          text = await transcribeAudio(message.voice.file_id);
        }

        try {
          const { data: existing } = await supabase
            .from('vanguard_stream')
            .select('id')
            .eq('metadata->>telegram_message_id', messageId.toString())
            .maybeSingle();
          if (existing) return;
        } catch (_) {}

        let shouldRespond = false;
        let mode = 'stream';
        let cleanText = text;

        if (text.startsWith('?'))       { shouldRespond = true; mode = 'chat';    cleanText = text.substring(1).trim(); }
        else if (text.startsWith('!!')) { shouldRespond = true; mode = 'deep';    cleanText = text.substring(2).trim(); }
        else if (text.startsWith('##')) { shouldRespond = false; mode = 'knowledge'; cleanText = text.substring(2).trim(); }
        else if (text.startsWith('@'))  { shouldRespond = true; mode = 'report';  cleanText = text.substring(1).trim(); }
        else if (text.toLowerCase().startsWith('poprawka:')) {
           shouldRespond = false;
           mode = 'knowledge';
           cleanText = text;
        }
        
        if (isVoice && mode === 'stream') {
          shouldRespond = true;
          if (text.includes('?')) mode = 'chat';
        }

        // --- MANDATORY STREAM RECORDING (BEFORE ANALYSIS) ---
        if (mode !== 'knowledge') {
          let streamEmbedding = null;
          try {
            const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: cleanText.replace(/\n/g, ' '),
              }),
            });
            const embedData = await embedRes.json();
            streamEmbedding = embedData.data?.[0]?.embedding;
          } catch (err) { console.error('[Vanguard] Stream embedding failed:', err); }

          await supabase.from('vanguard_stream').insert({
            user_id: VANGUARD_USER_ID,
            source: 'telegram',
            content: cleanText,
            embedding: streamEmbedding,
            metadata: { telegram_chat_id: chatId, telegram_message_id: messageId, mode }
          });
        }

        if (mode === 'knowledge') {
          let embedding = null;
          try {
            const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: cleanText.replace(/\n/g, ' '),
              }),
            });
            const embedData = await embedRes.json();
            embedding = embedData.data?.[0]?.embedding;
          } catch (e) {
            console.warn("Failed to generate embedding for knowledge:", e);
          }

          await supabase.from('vanguard_knowledge').insert({
            user_id: VANGUARD_USER_ID,
            title: cleanText.startsWith('Poprawka:') ? 'Poprawka użytkownika' : cleanText.substring(0, 50),
            content: cleanText,
            category: 'lesson',
            importance_score: 10,
            is_verified: true,
            embedding: embedding,
            source_type: 'TELEGRAM',
            metadata: { telegram_message_id: messageId }
          });

          if (cleanText.startsWith('Poprawka:')) {
            await supabase
              .from('user_fundament')
              .upsert({ 
                user_id: VANGUARD_USER_ID, 
                identity: cleanText.replace('Poprawka:', '').trim() 
              }, { onConflict: 'user_id' });
          }
        }

        let responseText = "";
        if (!shouldRespond) {
          responseText = mode === 'knowledge' ? '📖 Zaktualizowano moją wiedzę.' : '💭 Zapisano w Strumieniu.';
        } else {
          fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action: "typing" })
          }).catch(() => {});

          const { data: historyData } = await supabase
            .from('ai_chat_messages')
            .select('role, content')
            .eq('user_id', VANGUARD_USER_ID)
            .order('created_at', { ascending: false })
            .limit(10);

          const formattedHistory = (historyData || []).reverse();

          // --- EXTENDED STATE VECTOR (Biometry + Nutrition + Workouts + Wins) ---
          const today = new Date().toISOString().split('T')[0];
          const [aggregateRes, workoutRes, winRes] = await Promise.all([
            supabase.from('vanguard_daily_aggregates')
              .select('final_state, sleep_hours, hrv_avg, execution_score, dopamine_load_index')
              .eq('user_id', VANGUARD_USER_ID)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.from('vanguard_workouts')
              .select('created_at, day_key')
              .eq('user_id', VANGUARD_USER_ID)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.from('vanguard_daily_wins')
              .select('tasks, completed_tasks')
              .eq('user_id', VANGUARD_USER_ID)
              .eq('date', today)
              .maybeSingle()
          ]);

          const stateVector = {
            biometrics: aggregateRes.data || {},
            nutrition: { calories_today: 0 },
            physical: { last_workout: workoutRes.data || 'Brak danych' },
            discipline: { today_wins: winRes.data || 'Nie ustawiono celów' }
          };

          const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
            body: {
              current_query: cleanText,
              user_id: VANGUARD_USER_ID,
              state_vector: stateVector,
              mode: mode === 'report' ? 'mirror' : 'chat',
              thinking: mode === 'deep',
              history: formattedHistory
            }
          });

          if (error) {
            responseText = `⚠️ Oracle error: ${error.message}`;
          } else {
            let raw = (data?.text || "") as string;
            raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (!raw) responseText = "⚠️ Wyrocznia milczy (prawdopodobny timeout modelu reasoner). Spróbuj bez !!.";
            else responseText = raw.length > 4000 ? raw.substring(0, 4000) + '…' : raw;
          }
        }

        const hasButtons = shouldRespond && !responseText.startsWith('⚠️');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: responseText,
            parse_mode: 'Markdown',
            disable_notification: !shouldRespond,
            reply_markup: hasButtons ? {
              inline_keyboard: [
                [
                  { text: '👍 Dobra odpowiedź', callback_data: `fb_ok_${Date.now()}` },
                  { text: '👎 Popraw mnie', callback_data: `fb_err_${Date.now()}` }
                ]
              ]
            } : undefined
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
