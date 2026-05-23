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

function extractDayScore(text: string): number | null {
  const normalized = text.toLowerCase();
  const explicit = normalized.match(/(?:ocena dnia|dzie[nń]\s+na|oceniam(?:\s+dzie[nń])?)\D*([1-5])(?:\s*\/\s*5)?/i);
  if (explicit?.[1]) return Number(explicit[1]);

  const numberedAnswer = normalized.match(/(?:^|\n|\s)4[\).\:-]\s*([1-5])(?:\s*\/\s*5)?/i);
  if (numberedAnswer?.[1]) return Number(numberedAnswer[1]);

  return null;
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

// --- REALITY ADVERSARY ---
async function runRealityAdversary(
  yesterdayPlan: any | null,
  stream72h: any[]
): Promise<{
  biggest_inconsistency: string;
  most_relevant_open_loop: string;
  recommended_tension_action: {
    action: string;
    why_it_matters: string;
    minimum_version: string;
    due_time: string;
    verification: 'self' | 'human' | 'external_result';
  };
} | null> {
  try {
    const planContext = yesterdayPlan ? `PLAN NA WCZORAJ (${yesterdayPlan.target_date}):
- First move: ${yesterdayPlan.first_move_morning || '—'}
- Top 3: ${(yesterdayPlan.top3 || []).join(' | ')}
- Open loops: ${(yesterdayPlan.open_loops || []).join(' | ') || '—'}
- Tension action: ${yesterdayPlan.tension_action?.action || '—'} [status: ${yesterdayPlan.tension_action?.status || '—'}]` : 'BRAK planu na wczoraj.';

    const streamLines = stream72h
      .filter(s => s.content && s.content.trim().length > 10)
      .slice(0, 25)
      .map(s => {
        const dt = new Date(s.created_at).toLocaleString('pl', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        return `[${dt}] ${s.content.substring(0, 180)}`;
      })
      .join('\n');

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `Jesteś Reality Adversary. Analizujesz TYLKO dane z ostatnich 72h.

DOZWOLONE: "W ostatnich 72h powtarza się...", "Wczoraj plan był X, wykonanie było Y...", "To zadanie wraca trzeci raz...", "Najmniejszy ruch teraz to..."
ZAKAZANE: "Masz centralny wzorzec...", "To wynika z traumy...", "Twoim problemem jest...", "Od lat robisz...", "Musisz przepracować...", "Twój problem to..."

Odpowiedz TYLKO poprawnym JSON, zero markdown, zero dodatkowego tekstu.`
          },
          {
            role: 'user',
            content: `${planContext}

STRUMIEŃ OSTATNICH 72H:
${streamLines || 'Brak wpisów.'}

Wygeneruj JSON:
{
  "biggest_inconsistency": "rozjazd między planem a wykonaniem — jedno zdanie, tylko fakty z 72h",
  "most_relevant_open_loop": "co wraca 2-3 razy w ostatnich 72h — jedno zdanie, konkretna rzecz",
  "recommended_tension_action": {
    "action": "jeden konkretny ruch który jest odkładany — jedno zdanie imperatywne",
    "why_it_matters": "dlaczego ten ruch — oparte na danych z 72h, jedno zdanie",
    "minimum_version": "absolutne minimum — np. jedno zdanie zamiast całej odpowiedzi",
    "due_time": "konkretny czas np. 'do 14:00 jutro'",
    "verification": "self"
  }
}`
          }
        ]
      })
    });

    if (!dsRes.ok) {
      console.warn('[adversary] DeepSeek error:', dsRes.status);
      return null;
    }
    const dsData = await dsRes.json().catch(() => null);
    const raw = dsData?.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[adversary] no JSON in response');
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const sanitized = sanitizeAdversaryOutput(parsed);
    console.log('[adversary] output:', JSON.stringify(sanitized).substring(0, 200));
    return sanitized;
  } catch (err) {
    console.error('[adversary] error:', err);
    return null;
  }
}

// --- ADVERSARY POST-FILTER ---
const ADVERSARY_FALLBACK = 'W ostatnich 72h widać rozjazd między planem a wykonaniem. Wybierz jeden mały ruch, który zamknie najbliższą otwartą pętlę.';

const FORBIDDEN_ADVERSARY = /masz centralny wzorzec|to wynika z traumy|twoim problemem jest|od lat robisz|musisz przepracować|dzieci[eń]stwo|głęboka przyczyna|osobowo[sś][cć]|diagnoza/i;

function sanitizeAdversaryOutput<T extends Record<string, any>>(output: T): T {
  const result = { ...output } as Record<string, any>;

  // Top-level string fields
  for (const field of ['biggest_inconsistency', 'most_relevant_open_loop', 'adversary_note']) {
    if (typeof result[field] === 'string' && FORBIDDEN_ADVERSARY.test(result[field])) {
      console.warn(`[adversary] sanitized "${field}" — forbidden phrase detected`);
      result[field] = ADVERSARY_FALLBACK;
    }
  }

  // Nested recommended_tension_action fields
  if (result.recommended_tension_action && typeof result.recommended_tension_action === 'object') {
    const ta = { ...result.recommended_tension_action } as Record<string, any>;
    for (const field of ['action', 'why_it_matters', 'minimum_version']) {
      if (typeof ta[field] === 'string' && FORBIDDEN_ADVERSARY.test(ta[field])) {
        console.warn(`[adversary] sanitized "recommended_tension_action.${field}" — forbidden phrase detected`);
        ta[field] = ADVERSARY_FALLBACK;
      }
    }
    result.recommended_tension_action = ta;
  }

  return result as T;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    
    if (payload.callback_query) {
      const { id, data, message } = payload.callback_query;
      const chatId = message.chat.id;
      const callbackId = id;

      // --- MIDDAY CHECK CALLBACKS ---
      if (data === 'midday_yes' || data === 'midday_no' || data === 'midday_stuck') {
        EdgeRuntime.waitUntil((async () => {
          try {
            const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
            const { data: planRows } = await supabase
              .from('daily_reconciliations')
              .select('id, planning_summary')
              .eq('user_id', VANGUARD_USER_ID)
              .not('planning_summary', 'is', null)
              .order('answered_at', { ascending: false })
              .limit(5);

            const planRow = (planRows || []).find((r: any) =>
              r.planning_summary?.target_date === todayWarsawDate && !r.planning_summary?.parse_error
            );
            const plan = planRow?.planning_summary as any;

            // Save midday status
            if (planRow?.id) {
              const statusMap: Record<string, string> = { midday_yes: 'done', midday_no: 'not_done', midday_stuck: 'stuck' };
              await supabase
                .from('daily_reconciliations')
                .update({ midday_status: statusMap[data] })
                .eq('id', planRow.id);
            }

            // Build response — backward compat with old field names
            const firstMove = plan?.first_move_morning || plan?.pierwszy_ruch || '—';
            const mvd = plan?.minimum_viable_day || '—';
            const risk = plan?.biggest_risk || plan?.ryzyko || '—';
            const counter = plan?.counterplan || plan?.kontrplan || '—';

            let responseText = '';
            if (data === 'midday_yes') {
              responseText = 'Zapisane. Trzymaj Top 1.';
            } else if (data === 'midday_no') {
              responseText = `Minimum viable day:\n${mvd}\n\nRobisz teraz minimum?`;
            } else {
              responseText = `Ryzyko:\n${risk}\n\nKontrplan:\n${counter}\n\nCo blokuje: energia / niejasnosc / opor / zewnetrzne?`;
            }

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: callbackId, text: '' })
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard: [] } })
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: responseText, disable_notification: false })
            });
          } catch (err) {
            console.error('[telegram] midday callback error:', err);
          }
        })());
        return new Response('OK', { status: 200 });
      }

      // --- TENSION ACTION CALLBACKS (midday_ta_*) ---
      if (data === 'midday_ta_yes' || data === 'midday_ta_no' || data === 'midday_ta_stuck') {
        EdgeRuntime.waitUntil((async () => {
          try {
            const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
            const { data: planRows } = await supabase
              .from('daily_reconciliations')
              .select('id, planning_summary')
              .eq('user_id', VANGUARD_USER_ID)
              .not('planning_summary', 'is', null)
              .order('answered_at', { ascending: false })
              .limit(5);

            const planRow = (planRows || []).find((r: any) =>
              r.planning_summary?.target_date === todayWarsawDate && !r.planning_summary?.parse_error
            );
            const plan = planRow?.planning_summary as any;
            const ta = plan?.tension_action;

            // Update tension_action status in planning_summary
            if (planRow?.id && ta) {
              const newStatus = data === 'midday_ta_yes' ? 'done' : 'skipped';
              const updatedPlan = { ...plan, tension_action: { ...ta, status: newStatus } };
              await supabase.from('daily_reconciliations')
                .update({ planning_summary: updatedPlan })
                .eq('id', planRow.id);
            }

            let responseText = '';
            if (data === 'midday_ta_yes') {
              responseText = '⚡ Ruch napięciowy zrobiony. Zapisane.';
            } else {
              const minVersion = ta?.minimum_version || '—';
              responseText = `Minimum version:\n${minVersion}\n\nRobisz wersję minimalną teraz?`;
            }

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: callbackId, text: '' })
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard: [] } })
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: responseText })
            });
          } catch (err) {
            console.error('[telegram] ta callback error:', err);
          }
        })());
        return new Response('OK', { status: 200 });
      }

      // --- FEEDBACK CALLBACKS (fb_ok / fb_err) ---
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

    await (async () => {
      try {
        let streamRecordId: string | null = null;
        let deferredVaultIngest: { text: string; category: string } | null = null;
        let pendingReconciliation: { id: string; date: string } | null = null;
        let activePlanningSession: { id: string; history: any[] } | null = null;
        let planningEnded = false;

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

        const commandSource = isVoice ? text : originalText;
        const hasCommandPrefix = /^(\?|!!|##|@)/.test(commandSource.trim());
        const explicitVoiceCommand = isVoice && hasCommandPrefix;

        if (text.startsWith('?'))       { shouldRespond = true; mode = 'chat';    cleanText = text.substring(1).trim(); }
        else if (text.startsWith('!!')) { shouldRespond = true; mode = 'deep';    cleanText = text.substring(2).trim(); }
        else if (text.startsWith('##')) { shouldRespond = false; mode = 'knowledge'; cleanText = text.substring(2).trim(); }
        else if (text.startsWith('@'))  { shouldRespond = true; mode = 'report';  cleanText = text.substring(1).trim(); }
        else if (text.toLowerCase().startsWith('poprawka:')) {
           shouldRespond = false;
           mode = 'knowledge';
           cleanText = text;
        }

        if (!hasCommandPrefix && mode === 'stream') {
          // Check for active planning session first (planning_status = 'active' within 4h)
          const { data: activePlanning } = await supabase
            .from('daily_reconciliations')
            .select('id, planning_history, answered_at, created_at, date')
            .eq('user_id', VANGUARD_USER_ID)
            .eq('planning_status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activePlanning) {
            // Use answered_at as session start (when planning was triggered), fall back to created_at
            const sessionStart = activePlanning.answered_at || activePlanning.created_at;
            const ageMs = Date.now() - new Date(sessionStart).getTime();
            const history = (activePlanning.planning_history as any[]) || [];
            const PLANNING_WINDOW_MS = 120 * 60 * 1000;
            const PLANNING_MAX_ENTRIES = 20; // 10 turns × 2

            if (ageMs <= PLANNING_WINDOW_MS && history.length < PLANNING_MAX_ENTRIES) {
              if (/^(koniec|done|gotowe|wystarczy|stop|dziękuję|dziekuje|ok dzięki)\b/i.test(cleanText.trim())) {
                await supabase
                  .from('daily_reconciliations')
                  .update({ planning_status: 'completed' })
                  .eq('id', activePlanning.id);
                planningEnded = true;
                shouldRespond = false;
                mode = 'stream';

                // Generate structured plan summary in background
                const closureHistory = history.slice();
                const closureId = activePlanning.id;
                // Compute target date from reconciliation's Warsaw date + 1 day.
                // Using activePlanning.date (not new Date()) avoids off-by-one when closure
                // happens after Warsaw midnight (22:00+ UTC) — BUG-01 fix.
                const tomorrowWarsawDate = (() => {
                  const reconDate = (activePlanning as any).date as string; // e.g. "2026-05-22"
                  const d = new Date(reconDate + 'T12:00:00Z'); // noon UTC — safe from DST edge
                  d.setUTCDate(d.getUTCDate() + 1);
                  return d.toISOString().split('T')[0]; // "2026-05-23"
                })();
                // @ts-ignore
                EdgeRuntime.waitUntil((async () => {
                  let telegramText = '✅ Sesja planowania zakończona. Dobrej nocy!';
                  try {
                    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        model: 'deepseek-chat',
                        temperature: 0.3,
                        max_tokens: 900,
                        messages: [
                          {
                            role: 'system',
                            content: 'Jesteś asystentem planowania. Na podstawie sesji planowania wygeneruj plan jutra. Odpowiedz TYLKO poprawnym JSON-em, zero markdown, zero dodatkowego tekstu.'
                          },
                          ...closureHistory,
                          {
                            role: 'user',
                            content: `Wygeneruj plan na jutro (data: ${tomorrowWarsawDate}). Format JSON:\n{"target_date":"${tomorrowWarsawDate}","date":"${tomorrowWarsawDate}","top3":["zadanie1","zadanie2","zadanie3"],"first_move_morning":"kiedy i jak konkretnie — pierwsza akcja rano","biggest_risk":"największe ryzyko jutra","counterplan":"jak mu zapobiec","urgent_items":["pilna rzecz lub pusta tablica []"],"not_doing":["co świadomie odpuszczamy lub pusta tablica []"],"minimum_viable_day":"minimalna wersja wygranego dnia — jedno zdanie","confidence":"high|medium|low","open_loops":["rzeczy wiszące w powietrzu lub pusta tablica []"],"energy_state":"wysoka|średnia|niska","reconciliation_notes":"kluczowe obserwacje z dzisiejszego dnia","adversary_note":"co adversary wykrył z 72h — jedno zdanie, tylko fakty, zero psychologizowania","tension_action":{"action":"jeden konkretny ruch napięciowy ustalony w sesji — jedno zdanie imperatywne","why_it_matters":"dlaczego ten ruch — oparte na danych, jedno zdanie","minimum_version":"absolutne minimum tego ruchu — jedno zdanie","due_time":"konkretny czas np. do 14:00","verification":"self","status":"planned"}}`
                          }
                        ]
                      })
                    });

                    if (dsRes.ok) {
                      const dsData = await dsRes.json().catch(() => null);
                      const rawPlan = (dsData?.choices?.[0]?.message?.content || '').trim();

                      if (rawPlan) {
                        let planJson: any = null;
                        try {
                          const jsonMatch = rawPlan.match(/\{[\s\S]*\}/);
                          if (jsonMatch) planJson = JSON.parse(jsonMatch[0]);
                        } catch (_) {}

                        if (planJson?.top3) {
                          // GUARDRAIL: tension_action.action is required — revert if missing
                          if (!planJson?.tension_action?.action) {
                            console.warn('[telegram] tension_action missing — reverting planning to active');
                            const revertHistory = [
                              ...closureHistory,
                              { role: 'user', content: 'koniec' },
                              { role: 'assistant', content: 'Brakuje jednego ruchu napięciowego na jutro. Co odkładasz, bo jest niewygodne?' }
                            ];
                            await supabase
                              .from('daily_reconciliations')
                              .update({ planning_status: 'active', planning_history: revertHistory })
                              .eq('id', closureId);
                            telegramText = 'Brakuje jednego ruchu napięciowego na jutro. Co odkładasz, bo jest niewygodne?';
                          } else {
                            // Server-side stamp: target_date always correct regardless of model output
                            const summaryToSave = { ...planJson, target_date: tomorrowWarsawDate, date: tomorrowWarsawDate };
                            await supabase
                              .from('daily_reconciliations')
                              .update({ planning_summary: summaryToSave })
                              .eq('id', closureId);

                            // Format output using new schema fields
                            const top3 = (planJson.top3 as string[]).map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');
                            const urgentSection = (planJson.urgent_items as string[] || []).filter(Boolean).length > 0
                              ? `\n\nPilne:\n${(planJson.urgent_items as string[]).map((u: string) => `• ${u}`).join('\n')}` : '';
                            const notDoingSection = (planJson.not_doing as string[] || []).filter(Boolean).length > 0
                              ? `\n\nNie robimy:\n${(planJson.not_doing as string[]).map((u: string) => `• ${u}`).join('\n')}` : '';
                            const openLoopsSection = (planJson.open_loops as string[] || []).filter(Boolean).length > 0
                              ? `\n\nOtwarte petle:\n${(planJson.open_loops as string[]).map((u: string) => `• ${u}`).join('\n')}` : '';
                            const ta = planJson.tension_action as any;
                            const tensionSection = ta?.action
                              ? `\n\n⚡ Ruch napięciowy:\n${ta.action}\nMinimum: ${ta.minimum_version || '—'}\nDo: ${ta.due_time || '—'}`
                              : '';
                            const adversaryNoteSection = planJson.adversary_note
                              ? `\n\n🔍 ${planJson.adversary_note}`
                              : '';

                            telegramText = `Plan jutra zapisany.\n\nFirst move:\n${planJson.first_move_morning || '—'}\n\nTop 3:\n${top3}\n\nMinimum viable day:\n${planJson.minimum_viable_day || '—'}\n\nRyzyko: ${planJson.biggest_risk || '—'}\nKontrplan: ${planJson.counterplan || '—'}${tensionSection}${adversaryNoteSection}${urgentSection}${notDoingSection}${openLoopsSection}\n\nEnergia: ${planJson.energy_state || '—'} | Pewnosc: ${planJson.confidence || '—'}`;
                          }
                        } else {
                          // JSON parse failed → save raw fallback, send as-is (still readable)
                          console.warn('[telegram] plan JSON parse failed, saving raw');
                          await supabase
                            .from('daily_reconciliations')
                            .update({ planning_summary: { raw: rawPlan, parse_error: true, target_date: tomorrowWarsawDate } })
                            .eq('id', closureId);
                          telegramText = rawPlan.length > 4000 ? rawPlan.substring(0, 4000) + '…' : rawPlan;
                        }
                      }
                    } else {
                      console.error('[telegram] DeepSeek plan generation failed:', dsRes.status);
                    }
                  } catch (planSummaryErr) {
                    console.error('[telegram] plan summary error:', planSummaryErr);
                  }

                  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: telegramText,
                      disable_notification: false
                    })
                  });
                })());
              } else {
                activePlanningSession = { id: activePlanning.id, history };
                shouldRespond = true;
                mode = 'planning';
              }
            }
          }

          const { data: reconciliation } = !activePlanningSession && !planningEnded ? await supabase
            .from('daily_reconciliations')
            .select('id, date, created_at')
            .eq('user_id', VANGUARD_USER_ID)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() : { data: null };

          if (reconciliation) {
            const ageMs = Date.now() - new Date(reconciliation.created_at).getTime();
            if (ageMs >= 0 && ageMs <= 36 * 60 * 60 * 1000) {
              pendingReconciliation = {
                id: reconciliation.id,
                date: reconciliation.date
              };
              shouldRespond = false;
              mode = 'daily_reconciliation_response';
              cleanText = text.trim();
            }
          }
        }
        
        if (isVoice && !explicitVoiceCommand && mode !== 'daily_reconciliation_response' && mode !== 'planning') {
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
              ...(pendingReconciliation ? {
                reconciliation_id: pendingReconciliation.id,
                reconciliation_date: pendingReconciliation.date
              } : {}),
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

        if (pendingReconciliation) {
          const dayScore = extractDayScore(cleanText);
          const { error: reconciliationUpdateError } = await supabase
            .from('daily_reconciliations')
            .update({
              status: 'answered',
              user_response: cleanText,
              parsed_response: {
                raw_response: cleanText,
                stream_record_id: streamRecordId,
                parser_version: 'telegram_edge_v1'
              },
              day_score: dayScore,
              answered_at: new Date().toISOString()
            })
            .eq('id', pendingReconciliation.id);

          if (reconciliationUpdateError) {
            console.error("[telegram] reconciliation update failed:", reconciliationUpdateError);
          }

          // Trigger evening planning session after reconciliation is answered
          if (!reconciliationUpdateError) {
            // @ts-ignore
            EdgeRuntime.waitUntil((async () => {
              try {
                const reconId = pendingReconciliation!.id;
                const today = new Date().toISOString().split('T')[0];

                // Fetch context in parallel: state, todos, Todoist token, 72h stream, yesterday plan
                const yesterdayWarsawDate = (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  return d.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
                })();
                const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

                const [aggregateRes, winRes, userSettingsRes, stream72hRes, planHistoryRes, ouraLatestRes] = await Promise.all([
                  supabase.from('vanguard_daily_aggregates')
                    .select('final_state, sleep_hours, hrv_avg, execution_score')
                    .eq('user_id', VANGUARD_USER_ID)
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                  supabase.from('vanguard_daily_wins')
                    .select('tasks, completed_tasks')
                    .eq('user_id', VANGUARD_USER_ID)
                    .eq('date', today)
                    .maybeSingle(),
                  supabase.from('user_settings')
                    .select('todoist_token')
                    .eq('user_id', VANGUARD_USER_ID)
                    .maybeSingle(),
                  supabase.from('vanguard_stream')
                    .select('content, created_at, category, tags')
                    .eq('user_id', VANGUARD_USER_ID)
                    .gt('created_at', cutoff72h)
                    .not('content', 'eq', '')
                    .order('created_at', { ascending: false })
                    .limit(30),
                  supabase.from('daily_reconciliations')
                    .select('planning_summary')
                    .eq('user_id', VANGUARD_USER_ID)
                    .not('planning_summary', 'is', null)
                    .order('answered_at', { ascending: false })
                    .limit(5),
                  supabase.from('oura_daily_summary')
                    .select('date, total_sleep_hours, bedtime_timestamp, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes')
                    .eq('user_id', VANGUARD_USER_ID)
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                ]);

                const yesterdayPlan = (planHistoryRes.data || []).find((r: any) =>
                  r.planning_summary?.target_date === yesterdayWarsawDate && !r.planning_summary?.parse_error
                )?.planning_summary || null;

                // Run Reality Adversary
                const adversaryOutput = await runRealityAdversary(
                  yesterdayPlan,
                  stream72hRes.data || []
                );
                console.log('[telegram] adversary ran, output:', adversaryOutput ? 'ok' : 'null');

                // Fetch Todoist tasks if token available
                let todoistTasks = '';
                const todoistToken = userSettingsRes.data?.todoist_token;
                if (todoistToken) {
                  try {
                    const tRes = await fetch('https://api.todoist.com/rest/v2/tasks?filter=overdue|today', {
                      headers: { 'Authorization': `Bearer ${todoistToken}` }
                    });
                    if (tRes.ok) {
                      const tasks = await tRes.json();
                      if (tasks?.length > 0) {
                        todoistTasks = tasks
                          .slice(0, 15)
                          .map((t: any) => `- ${t.content}${t.due?.date ? ` (${t.due.date})` : ''}`)
                          .join('\n');
                      }
                    }
                  } catch (tErr) {
                    console.warn('[telegram] Todoist fetch failed:', tErr);
                  }
                }

                const adversarySection = adversaryOutput ? `\nREALITY ADVERSARY (dane z 72h — bez interpretacji, tylko fakty):
Rozjazd plan/wykonanie: ${adversaryOutput.biggest_inconsistency}
Powtarzający się open loop: ${adversaryOutput.most_relevant_open_loop}
Proponowany ruch napięciowy: ${adversaryOutput.recommended_tension_action.action}
Minimum version: ${adversaryOutput.recommended_tension_action.minimum_version}\n` : '';

                const planningQuery = `[PLANNING MODE - Evening Planning Session]\n\nReconciliation Jakuba na dziś:\n${cleanText}\n\n${adversarySection}${todoistTasks ? `Jego lista zadań z Todoist (dziś / zaległe):\n${todoistTasks}\n\n` : ''}Zadania z vanguard na dziś: ${JSON.stringify(winRes.data || 'brak')}\n\nRozpocznij sesję planowania na jutro. Odwołaj się do reconciliation i danych adversary'ego. Na końcu sesji zapytaj: "Jeden ruch napięciowy na jutro — co odkładasz, bo jest niewygodne?" i zasugeruj opcję z adversary'ego jeśli pasuje.`;

                const planningStateVector = {
                  biometrics: {
                    ...(aggregateRes.data || {}),
                    ...(ouraLatestRes.data ? {
                      oura_last_night: {
                        date: ouraLatestRes.data.date,
                        bedtime: ouraLatestRes.data.bedtime_timestamp,
                        sleep_hours: ouraLatestRes.data.total_sleep_hours,
                        readiness: ouraLatestRes.data.readiness_score,
                        hrv: ouraLatestRes.data.hrv_avg,
                        rhr: ouraLatestRes.data.rhr_avg,
                        deep_sleep_hours: ouraLatestRes.data.deep_sleep_hours,
                        rem_sleep_hours: ouraLatestRes.data.rem_sleep_hours,
                        sleep_efficiency: ouraLatestRes.data.sleep_efficiency,
                        latency_minutes: ouraLatestRes.data.latency_minutes,
                      }
                    } : {})
                  },
                  discipline: { today_wins: winRes.data || 'Nie ustawiono celów' }
                };

                const planController = new AbortController();
                const planTimeout = setTimeout(() => planController.abort(), 45000);

                const planRes = await fetch(`${SUPABASE_URL}/functions/v1/vanguard-oracle`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY
                  },
                  body: JSON.stringify({
                    current_query: planningQuery,
                    user_id: VANGUARD_USER_ID,
                    state_vector: planningStateVector,
                    mode: 'planning',
                    history: []
                  }),
                  signal: planController.signal
                }).catch(e => { console.error('[telegram] planning oracle fetch error:', e); return null; });
                clearTimeout(planTimeout);

                if (!planRes?.ok) {
                  console.error('[telegram] planning oracle error status:', planRes?.status);
                  return;
                }

                const planData = await planRes.json().catch(() => null);
                const planningText = (planData?.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                if (!planningText) {
                  console.warn('[telegram] planning oracle returned empty text');
                  return;
                }

                // Update reconciliation: activate planning, save initial message
                await supabase.from('daily_reconciliations').update({
                  planning_status: 'active',
                  planning_history: [{ role: 'assistant', content: planningText }]
                }).eq('id', reconId);

                // Send planning opener to Telegram
                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `🎯 ${planningText}`,
                    disable_notification: false
                  })
                });

                console.log('[telegram] planning session started for reconciliation:', reconId);
              } catch (planErr) {
                console.error('[telegram] planning session trigger error:', planErr);
              }
            })());
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
          responseText = mode === 'knowledge'
            ? '📖 Zaktualizowano moją wiedzę.'
            : mode === 'daily_reconciliation_response'
              ? '✅ Reconciliation zapisane.'
              : planningEnded
                ? '⏳ Zaraz generuję plan na jutro...'
                : '💭 Zapisano w Strumieniu.';
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
          const oracleHistory = mode === 'planning' && activePlanningSession
            ? activePlanningSession.history
            : formattedHistory;

          // --- EXTENDED STATE VECTOR (Biometry + Nutrition + Workouts + Wins + Today Plan) ---
          const today = new Date().toISOString().split('T')[0];
          const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
          const [aggregateRes, workoutRes, winRes, planRows, ouraRes] = await Promise.all([
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
              .maybeSingle(),
            supabase.from('daily_reconciliations')
              .select('planning_summary, answered_at')
              .eq('user_id', VANGUARD_USER_ID)
              .not('planning_summary', 'is', null)
              .order('answered_at', { ascending: false })
              .limit(5),
            supabase.from('oura_daily_summary')
              .select('date, total_sleep_hours, bedtime_timestamp, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes')
              .eq('user_id', VANGUARD_USER_ID)
              .order('date', { ascending: false })
              .limit(3)
          ]);

          const todayPlan = (planRows.data || []).find((r: any) =>
            r.planning_summary?.target_date === todayWarsawDate &&
            !r.planning_summary?.parse_error
          )?.planning_summary || null;

          const stateVector = {
            biometrics: {
              ...(aggregateRes.data || {}),
              ...(ouraRes.data?.[0] ? {
                oura_last_night: {
                  date: ouraRes.data[0].date,
                  bedtime: ouraRes.data[0].bedtime_timestamp,
                  sleep_hours: ouraRes.data[0].total_sleep_hours,
                  readiness: ouraRes.data[0].readiness_score,
                  hrv: ouraRes.data[0].hrv_avg,
                  rhr: ouraRes.data[0].rhr_avg,
                  deep_sleep_hours: ouraRes.data[0].deep_sleep_hours,
                  rem_sleep_hours: ouraRes.data[0].rem_sleep_hours,
                  sleep_efficiency: ouraRes.data[0].sleep_efficiency,
                  latency_minutes: ouraRes.data[0].latency_minutes,
                }
              } : {})
            },
            nutrition: { calories_today: 0 },
            physical: { last_workout: workoutRes.data || 'Brak danych' },
            discipline: { today_wins: winRes.data || 'Nie ustawiono celów' },
            ...(todayPlan ? { today_plan: todayPlan } : {})
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout

          let data: any = null;
          let error: any = null;
          try {
            const oracleRes = await fetch(`${SUPABASE_URL}/functions/v1/vanguard-oracle`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'apikey': SUPABASE_SERVICE_ROLE_KEY
              },
              body: JSON.stringify({
              current_query: cleanText,
              user_id: VANGUARD_USER_ID,
              state_vector: stateVector,
              mode: mode === 'planning' ? 'planning' : mode === 'report' ? 'mirror' : 'chat',
              thinking: mode === 'deep',
              history: oracleHistory
              }),
              signal: controller.signal
            });

            if (!oracleRes.ok) {
              const bodyText = await oracleRes.text().catch(() => '');
              error = new Error(`(Status ${oracleRes.status}) ${bodyText.substring(0, 200)}`);
            } else {
              data = await oracleRes.json();
            }
          } catch (invokeErr) {
            error = invokeErr;
          }
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

            // Update planning history after successful Oracle response
            if (mode === 'planning' && activePlanningSession && raw) {
              const updatedHistory = [
                ...activePlanningSession.history,
                { role: 'user', content: cleanText },
                { role: 'assistant', content: raw }
              ];
              await supabase
                .from('daily_reconciliations')
                .update({ planning_history: updatedHistory })
                .eq('id', activePlanningSession.id)
                .then(({ error: e }) => { if (e) console.error('[telegram] planning history update error:', e); });
            }
          }
        }

        const hasButtons = shouldRespond && !responseText.startsWith('⚠️') && mode !== 'planning';
        const telegramPayload = {
          chat_id: chatId,
          text: responseText,
          disable_notification: planningEnded ? false : !shouldRespond,
          reply_markup: hasButtons ? {
            inline_keyboard: [
              [
                { text: '👍 Dobra odpowiedź', callback_data: `fb_ok_${Date.now()}` },
                { text: '👎 Popraw mnie', callback_data: `fb_err_${Date.now()}` }
              ]
            ]
          } : undefined
        };

        const telegramSendRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(telegramPayload)
        });

        if (!telegramSendRes.ok) {
          const telegramError = await telegramSendRes.text().catch(() => 'unknown');
          console.error("[telegram] sendMessage failed:", telegramError);

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseText.replace(/[<>&]/g, ''),
              disable_notification: !shouldRespond
            })
          });
        }

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
    })();

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Parse error:", err);
    return new Response("OK", { status: 200 });
  }
});
