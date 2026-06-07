import { sendChatAction } from "../../_shared/telegram.ts";
import type { TelegramRouterContext } from "./config.ts";
import { getEmbedding } from "../../_shared/openai.ts";
import { inferVaultCategory, safeSendTelegram } from "../_utils/helpers.ts";
import { transcribeAudio } from "../_utils/whisper.ts";
import { PLANNING_END_PHRASES, getActivePlanningSession, closePlanningSession } from "../_handlers/planning.ts";
import { handleReconciliation } from "../_handlers/reconciliation.ts";
import { runAntiAnalysisGuard } from "../_handlers/antiAnalysis.ts";
import { logAuditEvent } from "../../_shared/audit.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { getRecentStrongBehavioralPatterns, getRecentEarlyWarnings } from "../../_shared/vanguardPatterns.ts";

export async function handleIncomingMessage(
  message: {
    text?: string;
    voice?: { file_id: string; duration?: number };
    message_id: number;
    chat: { id: number };
  },
  ctx: TelegramRouterContext,
): Promise<void> {
  const {
    supabase,
    telegramToken,
    openAiKey,
    deepseekApiKey,
    vanguardUserId,
    supabaseUrl,
    supabaseServiceRoleKey,
  } = ctx;

  const chatId = message.chat.id;
  const messageId = message.message_id;
  const isVoice = !!message.voice;
  let text = message.text || "";
  const originalText = text;

  try {
    let streamRecordId: string | null = null;
      let deferredVaultIngest: { text: string; category: string } | null = null;
      let pendingReconciliation: {
        id: string;
        date: string;
        mode?: string;
        parsed_response?: { mode?: string; [key: string]: unknown };
      } | null = null;
      let activePlanningSession: { id: string; history: any[] } | null = null;
      let planningEnded = false;

      // --- Voice transcription ---
      if (isVoice) {
        // Check if we are handling a pending reconciliation response or active planning to prevent sending '🎤 Słucham...' again.
        const activePlanning = await getActivePlanningSession(supabase, vanguardUserId);
        
        pendingReconciliation = null;
        if (!activePlanning) {
          const { data: reconciliation } = await supabase
            .from('daily_reconciliations')
            .select('id, date, created_at')
            .eq('user_id', vanguardUserId)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })
            .limit(1).maybeSingle();
          if (reconciliation) {
            const ageMs = Date.now() - new Date(reconciliation.created_at).getTime();
            if (ageMs >= 0 && ageMs <= 36 * 60 * 60 * 1000) {
              pendingReconciliation = reconciliation;
            }
          }
        }

        const skipListenMsg = pendingReconciliation || activePlanning;
        if (!skipListenMsg) {
          await safeSendTelegram(chatId, "🎤 Słucham...", telegramToken, { disable_notification: true });
        }
        text = await transcribeAudio(message.voice!.file_id, telegramToken, openAiKey);
      }

      // Idempotency guard
      try {
        const { data: existing, error: existErr } = await supabase.from('vanguard_stream').select('id')
          .eq('metadata->>telegram_message_id', messageId.toString()).maybeSingle();
        if (existErr) {
          console.error('[telegram] Idempotency DB check returned error:', existErr);
        }
        if (existing) return;
      } catch (err) {
        await logCriticalError({
          area: 'telegram-messages',
          error: err,
          message: 'Idempotency check failed',
        });
      }

      // --- Mode routing ---
      let shouldRespond = false;
      let mode = 'stream';
      let cleanText = text;

      const commandSource = isVoice ? text : originalText;
      const hasCommandPrefix = /^(\?|!!|##|@)/.test(commandSource.trim());
      const explicitVoiceCommand = isVoice && hasCommandPrefix;

      if (text.startsWith('?'))       { shouldRespond = true; mode = 'chat';      cleanText = text.substring(1).trim(); }
      else if (text.startsWith('!!')) { shouldRespond = true; mode = 'deep';      cleanText = text.substring(2).trim(); }
      else if (text.startsWith('##')) { shouldRespond = false; mode = 'knowledge'; cleanText = text.substring(2).trim(); }
      else if (text.startsWith('@'))  { shouldRespond = true; mode = 'report';    cleanText = text.substring(1).trim(); }
      else if (text.toLowerCase().startsWith('poprawka:')) { shouldRespond = false; mode = 'knowledge'; cleanText = text; }

      // Etap 1: Proste żądanie wzorców (po kolei)
      const lowerText = text.toLowerCase().trim();
      if (['wzorce', 'wzorzec', 'pokaż wzorce', 'moje wzorce', 'patterns', '/wzorce'].includes(lowerText)) {
        try {
          const patterns = await getRecentStrongBehavioralPatterns(supabase, vanguardUserId, 6, true);
          
          if (patterns.length === 0) {
            await safeSendTelegram(chatId, "Nie mam jeszcze zapisanych powtarzalnych wzorców dla Ciebie.", telegramToken);
            return;
          }

          // Rozdzielamy na zwykłe wzorce i early warnings dla lepszej historii
          const regularPatterns = patterns.filter(p => p.pattern_type !== 'early_warning');
          const earlyWarnings = await getRecentEarlyWarnings(supabase, vanguardUserId, 6);

          let response = "📈 Twoje aktualne wzorce behawioralne:\n\n";

          if (regularPatterns.length > 0) {
            regularPatterns.forEach((p, i) => {
              const statusEmoji = p.status === 'user_confirmed' ? '✅' : 
                                 p.status === 'user_rejected' ? '❌' : 
                                 p.status === 'snoozed' ? '⏸️' : '🔍';

              let typeLabel = p.pattern_type;
              if (p.pattern_type === 'recurring_blocker') typeLabel = 'Bloker';
              else if (p.pattern_type === 'plan_adherence_gap') typeLabel = 'Plan vs rzeczywistość';
              else if (p.pattern_type === 'morning_protocol_impact') typeLabel = 'Poranny protokół';
              else if (p.pattern_type === 'sleep_friction_link') typeLabel = 'Sen → tarcie';

              response += `${i+1}. ${statusEmoji} ${typeLabel}\n`;
              response += `   ${p.evidence_text}\n`;
              response += `   N=${p.occurrence_count} | pewność ${Math.round(p.confidence*100)}% | status: ${p.status}\n\n`;
            });
          } else {
            response += "Brak aktywnych powtarzalnych wzorców.\n\n";
          }

          if (earlyWarnings.length > 0) {
            response += "⚠️ Ostatnie wczesne ostrzeżenia (historia):\n\n";
            earlyWarnings.forEach((w, i) => {
              const date = w.last_seen ? w.last_seen : '—';
              const shown = w.last_shown ? ` (pokazane ${w.last_shown})` : '';
              const regime = w.metadata?.regime || 'nieznany';
              let regimeLabel = regime;
              if (regime === 'morning_drift') regimeLabel = 'Poranny dryf';
              else if (regime === 'repeated_adherence_failures') regimeLabel = 'Rozjazdy plan vs wykonanie';

              response += `${i+1}. [${date}] ${regimeLabel}${shown}\n`;
              response += `   ${w.evidence_text}\n`;
              response += `   pewność ${Math.round(w.confidence*100)}% | status: ${w.status}\n\n`;
            });
          }

          response += "Możesz reagować na wzorce w bridge'u wieczornym (przyciski 👍 / 👎 / ⏸).";

          await safeSendTelegram(chatId, response, telegramToken);
        } catch (err) {
          console.error('[messages] wzorce command failed:', err);
          await safeSendTelegram(chatId, "Coś poszło nie tak przy pobieraniu wzorców.", telegramToken);
        }
        return;
      }

      // --- /lenie command ---
      if (lowerText.startsWith('/lenie')) {
        try {
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
          const rest = text.slice('/lenie'.length).trim();
          // Format: "bodziec | kontekst" or just "opis"
          const [finalStimulus, contextNote] = rest.includes('|')
            ? rest.split('|').map(s => s.trim())
            : [rest, null];

          // Find or create Lenie habit
          let { data: habit } = await supabase
            .from('habits')
            .select('id')
            .eq('user_id', vanguardUserId)
            .ilike('name', '%lenie%')
            .maybeSingle();

          if (!habit) {
            const { data: newHabit, error: hErr } = await supabase
              .from('habits')
              .insert({ user_id: vanguardUserId, name: 'Lenie', icon: 'L', is_positive: false })
              .select('id').single();
            if (hErr) throw hErr;
            habit = newHabit;
          }

          // Upsert log for today
          const { error: logErr } = await supabase.from('habit_logs').upsert({
            user_id: vanguardUserId,
            habit_id: habit.id,
            date: today,
            completed: true,
            final_stimulus: finalStimulus || null,
            context_note: contextNote || null,
            logged_at: new Date().toISOString(),
          }, { onConflict: 'user_id,habit_id,date' });

          if (logErr) throw logErr;

          const label = finalStimulus ? `"${finalStimulus}"` : 'bez opisu';
          await safeSendTelegram(chatId, `✅ Lenie zapisane (${today})\nBodziec: ${label}${contextNote ? `\nKontekst: ${contextNote}` : ''}`, telegramToken);
        } catch (err) {
          console.error('[messages] /lenie failed:', err);
          await safeSendTelegram(chatId, '❌ Błąd zapisu lenie: ' + (err as Error).message, telegramToken);
        }
        return;
      }

      if (!hasCommandPrefix && mode === 'stream') {
        // Check active planning session
        const activePlanning = await getActivePlanningSession(supabase, vanguardUserId);
        if (activePlanning) {
          const cleanLower = cleanText.trim().toLowerCase();
          const isEnd = PLANNING_END_PHRASES.test(cleanLower) || cleanLower === 'tak';
          const isMin = cleanLower === 'minimum' || cleanLower === 'mvd' || cleanLower === 'min';

          if (isEnd || isMin) {
            let finalHistory = activePlanning.history;
            
            if (isMin) {
              // Perform the same minimum mutation as planning_show_minimum callback
              const lastAssistantMsg = [...activePlanning.history].reverse().find(h => h.role === 'assistant');
              if (lastAssistantMsg) {
                try {
                  const parsed = JSON.parse(lastAssistantMsg.content);
                  if (parsed.production_artifact) {
                    parsed.production_artifact.artifact = parsed.production_artifact.minimum_version || parsed.production_artifact.artifact;
                  }
                  if (parsed.tension_action) {
                    parsed.tension_action.action = parsed.tension_action.minimum_version || parsed.tension_action.action;
                  }
                  if (parsed.top3 && parsed.top3.length > 0) {
                    parsed.top3[0] = parsed.production_artifact?.artifact || parsed.top3[0];
                  }
                  parsed.one_clear_move = parsed.production_artifact?.artifact || parsed.one_clear_move;

                  finalHistory = activePlanning.history.map(h => {
                    if (h === lastAssistantMsg) return { role: 'assistant', content: JSON.stringify(parsed) };
                    return h;
                  });
                } catch (_) {}
              }
            }

            planningEnded = true;
            shouldRespond = false;
            mode = 'stream';
            
            await closePlanningSession(
              finalHistory,
              activePlanning.id,
              activePlanning.date,
              chatId,
              supabase,
              telegramToken,
              deepseekApiKey
            ).catch((err) => {
              console.error("[telegram] closePlanningSession error:", err);
            });
          } else {
            activePlanningSession = { id: activePlanning.id, history: activePlanning.history };
            shouldRespond = true;
            mode = 'planning';
          }
        }

        // Check pending reconciliation
        const { data: reconciliation } = !activePlanningSession && !planningEnded ? await supabase
          .from('daily_reconciliations')
          .select('id, date, created_at, mode, parsed_response')
          .eq('user_id', vanguardUserId)
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle() : { data: null };

        if (reconciliation) {
          const ageMs = Date.now() - new Date(reconciliation.created_at).getTime();
          if (ageMs >= 0 && ageMs <= 36 * 60 * 60 * 1000) {
            pendingReconciliation = { 
              id: reconciliation.id, 
              date: reconciliation.date, 
              mode: reconciliation.mode, 
              parsed_response: reconciliation.parsed_response 
            };
            shouldRespond = false;
            mode = 'daily_reconciliation_response';
            cleanText = text.trim();
          }
        }
      }

      if (isVoice && !explicitVoiceCommand && mode !== 'daily_reconciliation_response' && mode !== 'planning') {
        const transcriptWordCount = text.trim().split(/\s+/).filter(Boolean).length;
        shouldRespond = false;
        cleanText = text.trim();

        // Check if user is responding to a briefing sent in the last 2h.
        // If so, force stream regardless of word count — this is a reaction,
        // not a knowledge update.
        const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
        const { data: pendingBriefing } = await supabase
          .from('daily_reconciliations')
          .select('id')
          .eq('user_id', vanguardUserId)
          .eq('mode', 'briefing_response')
          .eq('status', 'sent')
          .gte('morning_sent_at', twoHoursAgo)
          .maybeSingle();

        if (pendingBriefing) {
          // All voice notes within the 2h window go to stream.
          // Window stays open until it expires naturally — no early close.
          mode = 'stream';
        } else {
          mode = transcriptWordCount > 120 ? 'knowledge' : 'stream';
        }
      }

      // --- Stream recording ---
      if (mode !== 'knowledge') {
        let streamEmbedding = null;
        let emotionData: { valence: number; arousal: number; state: string; energy_level?: number; stress_level?: number } | null = null;

        const voiceDurationSec = message.voice?.duration || 0;
        let voiceWpm: number | null = null;
        if (isVoice && voiceDurationSec > 0) {
          const wordCount = cleanText.trim().split(/\s+/).filter(Boolean).length;
          voiceWpm = Math.round(wordCount / (voiceDurationSec / 60));
        }

        try {
          const [embedRes, emotionRes] = await Promise.all([
            getEmbedding(cleanText, openAiKey),
            fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'deepseek-v4-flash', temperature: 0.1, max_tokens: 100,
                messages: [{ role: 'user', content: `Oceń emocje w tekście. Odpowiedz TYLKO JSON: {"valence":0.0,"arousal":0.0,"energy_level":3,"stress_level":3,"state":"nazwa"}\nvalence: -1.0(negatywny)→1.0(pozytywny), arousal: 0.0(spokojny)→1.0(pobudzony), energy_level: 1(wyczerpanie)→5(wysoka energia/czujność), stress_level: 1(spokój/luz)→5(silny stres/napięcie/frustracja), state: jedno słowo po polsku (Entuzjazm/Frustracja/Spokój/Zmęczenie/Euforia/Złość/Smutek/Determinacja/Stres/Radość/Nuda).\nTEKST: "${cleanText.substring(0, 400)}"` }]
              })
            }).catch((e) => {
              console.error('[telegram] Deepseek emotion fetch exception:', e);
              return null;
            })
          ]);

          if (Array.isArray(embedRes) && typeof embedRes[0] === 'number') {
            streamEmbedding = embedRes;
          } else {
            console.warn('[telegram] OpenAI embedding returned empty result');
          }

          if (emotionRes && (emotionRes as Response).ok) {
            const emotionJson = await (emotionRes as Response).json().catch((e) => {
              console.error('[telegram] Failed to parse emotion JSON response:', e);
              return null;
            });
            const rawEmotion = emotionJson?.choices?.[0]?.message?.content || '{}';
            try { 
              emotionData = JSON.parse(rawEmotion); 
            } catch (err) {
              console.error('[telegram] Failed to parse emotion text content to JSON:', err, rawEmotion);
            }
          }
        } catch (err) {
          await logCriticalError({
            area: 'telegram-messages',
            error: err,
            message: 'Stream embedding or emotion extraction failed',
          });
        }

        const { data: streamInserted, error: streamInsertError } = await supabase.from('vanguard_stream').insert({
          user_id: vanguardUserId,
          source: 'telegram',
          content: cleanText,
          embedding: streamEmbedding,
          metadata: {
            telegram_chat_id: chatId,
            telegram_message_id: messageId,
            mode,
            ...(pendingReconciliation ? { reconciliation_id: pendingReconciliation.id, reconciliation_date: pendingReconciliation.date } : {}),
            ...(isVoice && voiceDurationSec > 0 ? { voice_duration_seconds: voiceDurationSec, voice_wpm: voiceWpm } : {}),
            ...(emotionData ? { emotion: { ...emotionData, from_voice: isVoice } } : {})
          }
        }).select('id').single();

        if (streamInsertError) { console.error("[telegram] stream insert failed:", streamInsertError); }
        else if (streamInserted?.id) { streamRecordId = streamInserted.id; }

        if (emotionData) {
          console.log(`[telegram] emotion: ${emotionData.state} (v=${emotionData.valence?.toFixed(2)}, a=${emotionData.arousal?.toFixed(2)}) voice=${isVoice}`);
        }
      }

      // --- Anti-analysis guard ---
      if (mode === 'stream' && !hasCommandPrefix && !pendingReconciliation && !activePlanningSession && cleanText.length >= 120) {
        const intercepted = await runAntiAnalysisGuard(cleanText, chatId, supabase, telegramToken, deepseekApiKey, vanguardUserId);
        if (intercepted) return;
      }

      // --- Reconciliation response ---
      // All three handlers below send their own Telegram messages via safeSendTelegram.
      // Set handlerResponded=true so the final responseText send at the bottom is skipped.
      let handlerResponded = false;
      if (pendingReconciliation) {
        if (pendingReconciliation.parsed_response?.mode === 'saturday_checkin') {
          const { handleSaturdayCheckin } = await import('../_handlers/saturdayCheckin.ts');
          await handleSaturdayCheckin(
            pendingReconciliation.id, cleanText, streamRecordId, chatId,
            supabase, telegramToken, deepseekApiKey, vanguardUserId,
            pendingReconciliation.parsed_response
          );
          handlerResponded = true;
        } else if (pendingReconciliation.mode === 'morning_rescue') {
          const { handleMorningRescue } = await import('../_handlers/morningRescue.ts');
          await handleMorningRescue(
            pendingReconciliation.id, cleanText, chatId,
            supabase, telegramToken, deepseekApiKey,
          );
          handlerResponded = true;
        } else {
          await handleReconciliation(
            pendingReconciliation.id, cleanText, streamRecordId, chatId,
            supabase, telegramToken, deepseekApiKey,
            supabaseUrl, supabaseServiceRoleKey, vanguardUserId,
            pendingReconciliation.date
          );
          handlerResponded = true;
        }
      }

      // --- Knowledge mode ---
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
          await supabase.from('vanguard_preferences').upsert({
            user_id: vanguardUserId, key: 'custom_style_' + Date.now(), value: rawContent
          }, { onConflict: 'user_id, key' });
        } else if (isIdentityUpdate) {
          await supabase.from('user_fundament').upsert({ user_id: vanguardUserId, identity: rawContent }, { onConflict: 'user_id' });
        } else {
          // Route all user corrections / lessons through the proper ingestion path
          // (ingest-vault-log) instead of direct write to vanguard_knowledge.
          // This fixes the dual-write violation.
          const wordCount = rawContent.trim().split(/\s+/).filter(Boolean).length;
          const category = isGeneralPoprawka ? 'lesson' : inferVaultCategory(rawContent);

          if (wordCount > 80 || isGeneralPoprawka) {
            // Always go through controlled ingestion for corrections and long notes
            deferredVaultIngest = { text: rawContent, category };

            logAuditEvent({
              eventType: 'knowledge_ingest_deferred',
              severity: 'info',
              message: isGeneralPoprawka ? 'User correction routed via ingest-vault-log' : 'Long vault note routed via proper path',
              metadata: { category, length: rawContent.length, source: 'telegram' }
            });
          } else {
            // Very short non-correction vault notes still go to stream (existing behavior)
            deferredVaultIngest = { text: rawContent, category };
          }
        }
      }

      // --- Build response ---
      let responseText = "";
      if (!shouldRespond) {
        responseText = mode === 'knowledge'
          ? '📖 Zapisano w wiedzy (przez kontrolowany ingest).'
          : mode === 'daily_reconciliation_response'
            ? pendingReconciliation?.mode === 'morning_rescue'
              ? '⏳ Analizuję plan...'
              : '✅ Reconciliation zapisane.'
            : planningEnded
              ? '⏳ Zaraz generuję plan na jutro...'
              : '💭 Zapisano w Strumieniu.';
      } else {
        await sendChatAction(telegramToken, chatId, "typing");

        const { data: historyData } = await supabase.from('ai_chat_messages')
          .select('role, content').eq('user_id', vanguardUserId)
          .order('created_at', { ascending: false }).limit(10);

        const formattedHistory = (historyData || []).reverse();
        const oracleHistory = mode === 'planning' && activePlanningSession
          ? activePlanningSession.history
          : formattedHistory;

        // Extended state vector
        const todayWarsawDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
        const [aggregateRes, workoutRes, winRes, planRows, ouraRes] = await Promise.all([
          supabase.from('vanguard_daily_aggregates').select('final_state, sleep_hours, hrv_avg, execution_score, dopamine_load_index').eq('user_id', vanguardUserId).order('date', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('workout_sessions').select('created_at, workout_day').eq('user_id', vanguardUserId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('daily_wins').select('task_1, done_1, task_2, done_2, task_3, done_3, task_4, done_4, task_5, done_5, result').eq('user_id', vanguardUserId).eq('date', todayWarsawDate).maybeSingle(),
          supabase.from('daily_reconciliations').select('planning_summary, answered_at').eq('user_id', vanguardUserId).not('planning_summary', 'is', null).order('created_at', { ascending: false }).limit(5),
          supabase.from('oura_daily_summary').select('date, total_sleep_hours, bedtime_timestamp, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes').eq('user_id', vanguardUserId).order('date', { ascending: false }).limit(3)
        ]);

        const todayPlan = (planRows.data || []).find((r: any) =>
          r.planning_summary?.target_date === todayWarsawDate && !r.planning_summary?.parse_error
        )?.planning_summary || null;

        const stateVector = {
          biometrics: {
            ...(aggregateRes.data || {}),
            ...(ouraRes.data?.[0] ? {
              oura_last_night: {
                date: ouraRes.data[0].date, bedtime: ouraRes.data[0].bedtime_timestamp,
                sleep_hours: ouraRes.data[0].total_sleep_hours, readiness: ouraRes.data[0].readiness_score,
                hrv: ouraRes.data[0].hrv_avg, rhr: ouraRes.data[0].rhr_avg,
                deep_sleep_hours: ouraRes.data[0].deep_sleep_hours, rem_sleep_hours: ouraRes.data[0].rem_sleep_hours,
                sleep_efficiency: ouraRes.data[0].sleep_efficiency, latency_minutes: ouraRes.data[0].latency_minutes,
                sleep_data_status: ouraRes.data[0].date === todayWarsawDate ? 'synced' : 'pending'
              }
            } : { sleep_data_status: 'pending' })
          },
          nutrition: { calories_today: 0 },
          physical: { last_workout: workoutRes.data || 'Brak danych' },
          discipline: { today_wins: winRes.data || 'Nie ustawiono celów' },
          ...(todayPlan ? { today_plan: todayPlan } : {})
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);

        let data: any = null;
        let error: any = null;
        try {
          const oracleRes = await fetch(`${supabaseUrl}/functions/v1/vanguard-oracle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceRoleKey}`, 'apikey': supabaseServiceRoleKey },
            body: JSON.stringify({
              current_query: cleanText, user_id: vanguardUserId, state_vector: stateVector,
              mode: mode === 'planning' ? 'planning' : mode === 'report' ? 'mirror' : 'chat',
              thinking: mode === 'deep', history: oracleHistory
            }),
            signal: controller.signal
          });
          if (!oracleRes.ok) {
            const bodyText = await oracleRes.text().catch(() => '');
            error = new Error(`(Status ${oracleRes.status}) ${bodyText.substring(0, 200)}`);
          } else { data = await oracleRes.json(); }
        } catch (invokeErr) { error = invokeErr; }
        clearTimeout(timeoutId);

        if (error) {
          console.error("Oracle Invoke Error:", error);
          let errorDetail = error.message;
          if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
            errorDetail = "Przekroczono czas oczekiwania na Wyrocznię (timeout). Model DeepSeek Reasoner może być obecnie przeciążony.";
          }
          responseText = `⚠️ Oracle Error: ${errorDetail}`;
        } else {
          let raw = (data?.text || "") as string;
          raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          if (!raw) {
            console.error(`[telegram] oracle returned empty text — data keys: ${data ? Object.keys(data).join(',') : 'null'}`);
            responseText = "⚠️ Oracle: pusta odpowiedź modelu. Spróbuj jeszcze raz.";
          } else {
            responseText = raw.length > 4000 ? raw.substring(0, 4000) + '…' : raw;
          }

          if (mode === 'planning' && activePlanningSession && raw) {
            const updatedHistory = [...activePlanningSession.history, { role: 'user', content: cleanText }, { role: 'assistant', content: raw }];
            await supabase.from('daily_reconciliations').update({ planning_history: updatedHistory }).eq('id', activePlanningSession.id)
              .then(({ error: e }: any) => { if (e) console.error('[telegram] planning history update error:', e); });
          } else if (raw) {
            const chatInsertRes = await supabase.from('ai_chat_messages').insert([
              { user_id: vanguardUserId, role: 'user', content: cleanText },
              { user_id: vanguardUserId, role: 'assistant', content: raw }
            ]);
            if (chatInsertRes.error) { console.error('[telegram] ai_chat_messages insert error:', chatInsertRes.error); }
            else {
              const { data: oldMsgs } = await supabase.from('ai_chat_messages').select('id').eq('user_id', vanguardUserId).order('created_at', { ascending: false }).range(200, 9999);
              if (oldMsgs && oldMsgs.length > 0) {
                await supabase.from('ai_chat_messages').delete().in('id', oldMsgs.map((m: any) => m.id))
                  .then(({ error: e }: any) => { if (e) console.error('[telegram] ai_chat_messages trim error:', e); });
              }
            }
          }
        }
      }

      // --- Send response ---
      // Skip if a dedicated handler (reconciliation/rescue/saturday) already sent its own message.
      if (handlerResponded) {
        console.log('[telegram] handler already responded — skipping final responseText send');
        return;
      }

      const hasButtons = shouldRespond && !responseText.startsWith('⚠️') && mode !== 'planning';
      const telegramPayload = {
        chat_id: chatId,
        text: responseText,
        disable_notification: planningEnded ? false : !shouldRespond,
        reply_markup: hasButtons ? {
          inline_keyboard: [[
            { text: '👍 Dobra odpowiedź', callback_data: `fb_ok_${Date.now()}` },
            { text: '👎 Popraw mnie', callback_data: `fb_err_${Date.now()}` }
          ]]
        } : undefined
      };

      const isSent = await safeSendTelegram(chatId, responseText, telegramToken, {
        disable_notification: telegramPayload.disable_notification,
        reply_markup: telegramPayload.reply_markup
      });

      if (!isSent) {
        console.error("[telegram] sendMessage failed, attempting fallback...");
        await safeSendTelegram(chatId, responseText.replace(/[<>&]/g, ''), telegramToken, {
          disable_notification: !shouldRespond
        });
      }

      // --- Deferred vault ingest ---
      if (deferredVaultIngest) {
        try {
          const { error: ingestError } = await supabase.functions.invoke('ingest-vault-log', {
            body: { userId: vanguardUserId, text: deferredVaultIngest.text, category: deferredVaultIngest.category }
          });
          if (ingestError) console.error("Long knowledge ingest failed:", ingestError);
        } catch (err) {
          await logCriticalError({
            area: 'telegram-messages',
            error: err,
            message: 'Long knowledge background ingest error',
            metadata: { nonFatal: true },
          });
        }
      }

      // --- Architect invoke ---
      if (streamRecordId) {
        try {
          const { error: architectError } = await supabase.functions.invoke('vanguard-architect', {
            body: { type: 'stream', record_id: streamRecordId, limit: 1 }
          });
          if (architectError) console.error("[telegram] architect invoke failed:", architectError);
        } catch (err) {
          await logCriticalError({
            area: 'telegram-messages',
            error: err,
            message: 'Architect background invoke error',
            metadata: { nonFatal: true },
          });
        }
      }
  } catch (innerErr) {
    await logCriticalError({
      area: 'telegram-messages',
      error: innerErr,
      message: 'Unhandled error in handleIncomingMessage',
    });
    await safeSendTelegram(chatId, `⚠️ Błąd: ${(innerErr as Error).message}`, telegramToken);
  }
}
