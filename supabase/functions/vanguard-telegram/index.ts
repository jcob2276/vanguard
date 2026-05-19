import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || "";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || '165ae341-670c-46ce-82dc-434c4dbfcdfd'; // Use fallback from architect
const AUTHORIZED_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function inferVaultCategory(text: string) {
  const head = text.slice(0, 700).toLowerCase();
  const explicit = head.match(/(?:kategoria|category)\s*:\s*([a-ząćęłńóśźż0-9_-]+)/i);
  if (explicit?.[1]) return explicit[1]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();

  if (/dziecinstw|dzieciństw|rodzin|mama|tata|ojciec|matka|brat|siostr|babci/.test(head)) return "family_childhood";
  if (/relacj|dziewczyn|zwiazk|związk|randk|bliskosc|bliskość|seks/.test(head)) return "relationships";
  if (/pieniadz|pieniądz|kasa|zarab|sprzedaz|sprzedaż|biznes|praca/.test(head)) return "money_work";
  if (/cial|ciał|zdrow|sen|oura|trening|silown|siłown|jedzenie|energia/.test(head)) return "body_health";
  if (/wizj|marz|cel|przyszlosc|przyszłość|chce byc|chcę być/.test(head)) return "future_vision";
  if (/szkol|studia|nauka|egzamin|poraż|poraz|sukces/.test(head)) return "school_history";
  return "telegram_vault";
}

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!whisperRes.ok) {
      const errText = await whisperRes.text().catch(() => 'unknown')
      throw new Error(`Whisper HTTP error (${whisperRes.status}): ${errText.substring(0, 200)}`)
    }
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
    const originalText = text;

    if (chatId !== AUTHORIZED_CHAT_ID) {
      return new Response("OK", { status: 200 });
    }

    EdgeRuntime.waitUntil((async () => {
      try {
        let streamRecordId: string | null = null;
        let deferredVaultIngest: { text: string; category: string } | null = null;

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

        const explicitVoiceCommand = isVoice && /^(\\?|!!|##|@)/.test(originalText.trim());

        if (text.startsWith('?'))       { shouldRespond = true; mode = 'chat';    cleanText = text.substring(1).trim(); }
        else if (text.startsWith('!!')) { shouldRespond = true; mode = 'deep';    cleanText = text.substring(2).trim(); }
        else if (text.startsWith('##')) { shouldRespond = false; mode = 'knowledge'; cleanText = text.substring(2).trim(); }
        else if (text.startsWith('@'))  { shouldRespond = true; mode = 'report';  cleanText = text.substring(1).trim(); }
        else if (text.toLowerCase().startsWith('poprawka:')) {
           shouldRespond = false;
           mode = 'knowledge';
           cleanText = text;
        }
        
        if (isVoice && !explicitVoiceCommand) {
          const transcriptWordCount = text.trim().split(/\s+/).filter(Boolean).length;
          if (transcriptWordCount > 120) {
            shouldRespond = false;
            mode = 'knowledge';
            cleanText = text.trim();
          } else {
            shouldRespond = false;
            mode = 'stream';
            cleanText = text.trim();
          }
        }

        // --- MANDATORY STREAM RECORDING (BEFORE ANALYSIS) ---
        if (mode !== 'knowledge') {
          let streamEmbedding = null;
          let emotionData: { valence: number; arousal: number; state: string } | null = null;

          try {
            // Embedding + emotion analysis równolegle (zero dodatkowego opóźnienia)
            const [embedRes, emotionRes] = await Promise.all([
              fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'text-embedding-3-small', input: cleanText.replace(/\n/g, ' ') }),
              }),
              fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'deepseek-chat',
                  temperature: 0.1,
                  max_tokens: 80,
                  messages: [{
                    role: 'user',
                    content: `Oceń emocje w tekście. Odpowiedz TYLKO JSON: {"valence":0.0,"arousal":0.0,"state":"nazwa"}\nvalence: -1.0(bardzo negatywny)→1.0(bardzo pozytywny), arousal: 0.0(spokojny)→1.0(bardzo pobudzony), state: jedno słowo po polsku (Entuzjazm/Frustracja/Spokój/Zmęczenie/Euforia/Złość/Smutek/Determinacja/Stres/Radość).\nTEKST: "${cleanText.substring(0, 400)}"`
                  }]
                })
              }).catch(() => null)
            ]);

            if (embedRes.ok) {
              const embedData = await embedRes.json();
              streamEmbedding = embedData.data?.[0]?.embedding;
            } else {
              console.warn(`[telegram] OpenAI embedding HTTP error: ${embedRes.status}`)
            }

            if (emotionRes && (emotionRes as Response).ok) {
              const emotionJson = await (emotionRes as Response).json().catch(() => null);
              const rawEmotion = emotionJson?.choices?.[0]?.message?.content || '{}';
              try { emotionData = JSON.parse(rawEmotion); } catch {}
            }
          } catch (err) { console.error('[Vanguard] Stream embedding/emotion failed:', err); }

          const { data: streamInserted, error: streamInsertError } = await supabase.from('vanguard_stream').insert({
            user_id: VANGUARD_USER_ID,
            source: 'telegram',
            content: cleanText,
            embedding: streamEmbedding,
            metadata: {
              telegram_chat_id: chatId,
              telegram_message_id: messageId,
              mode,
              ...(emotionData ? { emotion: { ...emotionData, from_voice: isVoice } } : {})
            }
          }).select('id').single();

          if (streamInsertError) {
            console.error("[telegram] stream insert failed:", streamInsertError);
          } else if (streamInserted?.id) {
            streamRecordId = streamInserted.id;
          }

          if (emotionData) {
            console.log(`[telegram] emotion: ${emotionData.state} (v=${emotionData.valence?.toFixed(2)}, a=${emotionData.arousal?.toFixed(2)}) voice=${isVoice}`);
          }
        }

        if (mode === 'knowledge') {
          const lowerText = cleanText.toLowerCase();
          const isIdentityUpdate = lowerText.startsWith('poprawka tożsamość:');
          const isGeneralPoprawka = !isIdentityUpdate && lowerText.startsWith('poprawka:');
          
          let rawContent = cleanText;
          if (isIdentityUpdate) rawContent = cleanText.substring(19).trim();
          else if (isGeneralPoprawka) rawContent = cleanText.substring(9).trim();

          const isBehavioral = isGeneralPoprawka && 
            /(nie mów|nie pisz|nie zaczynaj|nie używaj|styl|ton|forma odpowiedzi|odpowiadaj|pisz do mnie|mów do mnie)/i.test(rawContent);

          if (isBehavioral) {
            // 1. Zapisz do preferencji (behawioralne)
            await supabase.from('vanguard_preferences').upsert({
              user_id: VANGUARD_USER_ID,
              key: 'custom_style_' + Date.now(),
              value: rawContent
            }, { onConflict: 'user_id, key' });
          } else if (isIdentityUpdate) {
            // 2. Jawna zmiana tożsamości (Fundament)
            await supabase
              .from('user_fundament')
              .upsert({ 
                user_id: VANGUARD_USER_ID, 
                identity: rawContent 
              }, { onConflict: 'user_id' });
          } else {
            // 3. Normalna wiedza lub ogólna poprawka (tylko do wiedzy semantycznej)
            const wordCount = rawContent.trim().split(/\s+/).filter(Boolean).length;
            if (!isGeneralPoprawka && wordCount > 120) {
              deferredVaultIngest = {
                text: rawContent,
                category: inferVaultCategory(rawContent)
              };
            } else {
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
              if (!embedRes.ok) {
                console.warn(`[telegram] OpenAI knowledge embedding HTTP error: ${embedRes.status}`);
              } else {
                const embedData = await embedRes.json();
                embedding = embedData.data?.[0]?.embedding;
              }
            } catch (e) {
              console.warn("Failed to generate embedding for knowledge:", e);
            }

            await supabase.from('vanguard_knowledge').insert({
              user_id: VANGUARD_USER_ID,
              title: isGeneralPoprawka ? 'Poprawka użytkownika' : cleanText.substring(0, 50),
              content: cleanText,
              category: 'lesson',
              importance_score: 10,
              is_verified: true,
              embedding: embedding,
              source_type: 'TELEGRAM',
              metadata: { telegram_message_id: messageId }
            });
            }
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

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout

          const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
            body: {
              current_query: cleanText,
              user_id: VANGUARD_USER_ID,
              state_vector: stateVector,
              mode: mode === 'report' ? 'mirror' : 'chat',
              thinking: mode === 'deep',
              history: formattedHistory
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (error) {
            console.error("Oracle Invoke Error:", error);
            let errorDetail = error.message;
            
            if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
              errorDetail = "Przekroczono czas oczekiwania na Wyrocznię (timeout). Model DeepSeek Reasoner może być obecnie przeciążony.";
            } else if (error && (error as any).context) {
              try {
                const ctx = (error as any).context;
                const status = ctx.status;
                const bodyText = await ctx.text();
                errorDetail = `(Status ${status}) ${bodyText.substring(0, 150)}`;
              } catch (e) {
                console.error("Failed to parse error context:", e);
              }
            }
            responseText = `⚠️ Oracle Error: ${errorDetail}`;
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

        if (deferredVaultIngest) {
          try {
            const { data: ingestData, error: ingestError } = await supabase.functions.invoke('ingest-vault-log', {
              body: {
                userId: VANGUARD_USER_ID,
                text: deferredVaultIngest.text,
                category: deferredVaultIngest.category
              }
            });
            if (ingestError) console.error("Long knowledge ingest failed:", ingestError);
            else console.log("Long knowledge routed to ingest-vault-log:", ingestData);
          } catch (err) {
            console.error("Long knowledge background ingest error:", err);
          }
        }

        if (streamRecordId) {
          try {
            const { data: architectData, error: architectError } = await supabase.functions.invoke('vanguard-architect', {
              body: {
                type: 'stream',
                record_id: streamRecordId,
                limit: 1
              }
            });
            if (architectError) console.error("[telegram] architect invoke failed:", architectError);
            else console.log("[telegram] architect processed stream record:", architectData);
          } catch (err) {
            console.error("[telegram] architect background error:", err);
          }
        }

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
