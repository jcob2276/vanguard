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
    // 1. Pobierz ścieżkę do pliku z Telegrama
    const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("Nie udało się pobrać ścieżki pliku z Telegrama");

    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

    // 2. Pobierz plik binarny
    const audioRes = await fetch(fileUrl);
    const audioBlob = await audioRes.blob();

    // 3. Wyślij do OpenAI Whisper
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
    
    // --- OBSŁUGA CALLBACK_QUERY (Przycisków 👍/👎) ---
    if (payload.callback_query) {
      const { id, data, message } = payload.callback_query;
      const chatId = message.chat.id;
      const callbackId = id;
      
      // Parsowanie danych: fb_ok_TIMESTAMP lub fb_err_TIMESTAMP
      const isOk = data.startsWith('fb_ok');
      const score = isOk ? 1 : -1;
      
      EdgeRuntime.waitUntil((async () => {
        try {
          // 1. Zapisz feedback
          await supabase.from('vanguard_feedback').insert({
            user_id: VANGUARD_USER_ID,
            message_id: message.message_id.toString(),
            query: message.reply_to_message?.text || "Unknown",
            reply: message.text,
            score: score,
            metadata: { callback_data: data }
          });

          // 2. Jeśli 👍 -> oznacz ostatnią wiedzę z tej rozmowy jako zweryfikowaną
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

          // 3. Poinformuj użytkownika i usuń przyciski
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

    // 1. Zabezpieczenie: Tylko Jakub
    if (chatId !== AUTHORIZED_CHAT_ID) {
      return new Response("OK", { status: 200 });
    }

    // 2. NATYCHMIASTOWY ACK
    EdgeRuntime.waitUntil((async () => {
      try {
        // 3. Audio Pipeline
        if (isVoice) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: "🎤 Słucham...", disable_notification: true })
          }).catch(() => {});

          text = await transcribeAudio(message.voice.file_id);
        }

        // 4. Idempotencja
        try {
          const { data: existing } = await supabase
            .from('vanguard_stream')
            .select('id')
            .eq('metadata->>telegram_message_id', messageId.toString())
            .maybeSingle();
          if (existing) return;
        } catch (_) {}

        // 5. Parsowanie prefiksu
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
           cleanText = text; // Zachowaj cały tekst poprawki
        }
        
        if (isVoice && mode === 'stream') {
          shouldRespond = true;
          if (text.includes('?')) mode = 'chat';
        }

        // 5. Zapis do bazy
        if (mode === 'knowledge') {
          // Generowanie embeddingu
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

          // 1. Zapisz w Baza Wiedzy
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

          // 2. Jeśli to poprawka tożsamości -> zaktualizuj Fundament (SSOT)
          if (cleanText.toLowerCase().includes('studiuję') || cleanText.toLowerCase().includes('mam') || cleanText.startsWith('Poprawka:')) {
            await supabase
              .from('user_fundament')
              .upsert({ 
                user_id: VANGUARD_USER_ID, 
                identity: cleanText.replace('Poprawka:', '').trim() 
              }, { onConflict: 'user_id' });
          }
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
          responseText = mode === 'knowledge' ? '📖 Zaktualizowano moją wiedzę.' : '💭 Zapisano w Strumieniu.';
        } else {
          fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action: "typing" })
          }).catch(() => {});

          const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
            body: {
              current_query: cleanText,
              user_id: VANGUARD_USER_ID,
              mode: mode === 'report' ? 'mirror' : 'chat',
              thinking: mode === 'deep',
              history: []
            }
          });

          if (error) {
            responseText = `⚠️ Oracle error: ${error.message}`;
          } else {
            let raw = data.text as string;
            raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            responseText = raw.length > 4000 ? raw.substring(0, 4000) + '…' : raw;
          }
        }

        // 7. Wyślij odpowiedź z przyciskami (tylko dla Oracle)
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



