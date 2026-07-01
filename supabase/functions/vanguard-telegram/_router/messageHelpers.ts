import type { TelegramRouterContext } from "./config.ts";
import { getEmbedding } from "../../_shared/openai.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { getWarsawDateString, getWarsawDayBoundaries } from "../../_shared/time.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { logAuditEvent } from "../../_shared/audit.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { sendChatAction } from "../../_shared/telegram.ts";
import {
  handleTodoCommand,
  handleKeepCommand,
  handlePosilekCommand,
} from "./commands.ts";

/**
 * Handles ForceReply prompts based on prefix check.
 * Returns true if the message was handled (meaning execution should stop), false otherwise.
 */
export async function handleForceReplyReply(
  promptText: string,
  text: string,
  chatId: number,
  ctx: TelegramRouterContext,
): Promise<boolean> {
  const { supabase, telegramToken, deepseekApiKey, supabaseUrl, supabaseServiceRoleKey, vanguardUserId } = ctx;

  if (promptText.includes("Zapis Lenie")) {
    const { handleLenieCommand } = await import("./commands.ts");
    await handleLenieCommand(`/lenie ${text}`, chatId, telegramToken, supabase, vanguardUserId);
    return true;
  }
  if (promptText.includes("Zapis postu")) {
    const { handlePostCommand } = await import("./commands.ts");
    await handlePostCommand(`/post ${text}`, chatId, telegramToken, supabase, vanguardUserId);
    return true;
  }
  if (promptText.includes("Zadaj pytanie Wyroczni")) {
    // Falls through to normal flow with modified text (? prefix)
    return false;
  }
  if (promptText.includes("Wpisz poprawkę do wiedzy")) {
    // Falls through to normal flow with modified text (poprawka: prefix)
    return false;
  }
  if (promptText.includes("Nowe zadanie")) {
    await handleTodoCommand(text, chatId, telegramToken, supabase, vanguardUserId, deepseekApiKey);
    return true;
  }
  if (promptText.includes("Vanguard Keep")) {
    await handleKeepCommand(text, chatId, telegramToken, supabase, vanguardUserId, false);
    return true;
  }
  if (promptText.includes("Co zjadłeś?")) {
    await handlePosilekCommand(text, chatId, telegramToken, supabase, vanguardUserId, deepseekApiKey, supabaseUrl, supabaseServiceRoleKey);
    return true;
  }
  if (promptText.includes("Zapisano (")) {
    const { handleMealCorrection } = await import("../_handlers/foodCorrection.ts");
    const handled = await handleMealCorrection(promptText, text, vanguardUserId, supabase, telegramToken, chatId, deepseekApiKey);
    if (handled) return true;
  }
  return false;
}

/**
 * Checks idempotency for incoming messages to prevent double processing.
 */
export async function checkIdempotency(
  messageId: number,
  chatId: number,
  ctx: TelegramRouterContext,
  tryResumeReconciliation: (messageId: number, chatId: number, ctx: any) => Promise<boolean>,
): Promise<{ exists: boolean; shouldStop: boolean }> {
  const { supabase } = ctx;
  try {
    const { data: existing, error: existErr } = await supabase
      .from('vanguard_stream')
      .select('id, content, metadata')
      .eq('metadata->>telegram_message_id', messageId.toString())
      .maybeSingle();

    if (existErr) {
      console.error('[telegram] Idempotency DB check returned error:', existErr);
    }

    if (existing) {
      const reconId = (existing.metadata as { reconciliation_id?: string } | null)?.reconciliation_id;
      if (reconId && existing.content) {
        const { data: recon } = await supabase
          .from('daily_reconciliations')
          .select('id, date, status')
          .eq('id', reconId)
          .maybeSingle();
        if (recon?.status === 'sent') {
          const resumed = await tryResumeReconciliation(messageId, chatId, ctx);
          return { exists: true, shouldStop: resumed };
        }
      }
      return { exists: true, shouldStop: true };
    }
  } catch (err) {
    await logCriticalError({
      area: 'telegram-messages',
      error: err,
      message: 'Idempotency check failed',
    });
  }
  return { exists: false, shouldStop: false };
}

/**
 * Saves incoming message to vanguard_stream, computing OpenAI embedding and extracting emotions via DeepSeek.
 */
export async function insertStreamRecord(
  cleanText: string,
  mode: string,
  isVoice: boolean,
  voiceDurationSec: number,
  voiceWpm: number | null,
  pendingReconciliation: { id: string; date: string } | null,
  chatId: number,
  messageId: number,
  ctx: TelegramRouterContext,
): Promise<{ streamRecordId: string | null; streamSaveFailed: boolean }> {
  const { supabase, openAiKey, deepseekApiKey, vanguardUserId } = ctx;
  const skipStreamEnrichment = mode === 'daily_reconciliation_response' || !!pendingReconciliation;

  let streamEmbedding = null;
  let emotionData: { valence: number; arousal: number; state: string; energy_level?: number; stress_level?: number } | null = null;
  let streamSaveFailed = false;
  let streamRecordId: string | null = null;

  if (!skipStreamEnrichment && cleanText.trim()) {
    try {
      const [embedRes, emotionRes] = await Promise.all([
        getEmbedding(cleanText, openAiKey),
        deepseekChat({
          apiKey: deepseekApiKey,
          model: 'deepseek-v4-flash',
          temperature: 0.1,
          maxTokens: 100,
          responseFormat: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: `Oceń emocje w tekście. Odpowiedz TYLKO JSON: {"valence":0.0,"arousal":0.0,"energy_level":3,"stress_level":3,"state":"nazwa"}\nvalence: -1.0(negatywny)→1.0(pozytywny), arousal: 0.0(spokojny)→1.0(pobudzony), energy_level: 1(wyczerpanie)→5(wysoka energia/czujność), stress_level: 1(spokój/luz)→5(silny stres/napięcie/frustracja), state: jedno słowo po polsku (Entuzjazm/Frustracja/Spokój/Zmęczenie/Euforia/Złość/Smutek/Determinacja/Stres/Radość/Nuda).\nTEKST: "${cleanText.substring(0, 400)}"`
          }]
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

      if (emotionRes && 'content' in emotionRes) {
        emotionData = parseJsonFromContent(emotionRes.content || '{}') as any;
      }
    } catch (err) {
      await logCriticalError({
        area: 'telegram-messages',
        error: err,
        message: 'Stream embedding or emotion extraction failed',
      });
    }
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

  if (streamInsertError) {
    console.error("[telegram] stream insert failed:", streamInsertError);
    streamSaveFailed = true;
  } else if (streamInserted?.id) {
    streamRecordId = streamInserted.id;
  }

  if (emotionData) {
    console.log(`[telegram] emotion: ${emotionData.state} (v=${emotionData.valence?.toFixed(2)}, a=${emotionData.arousal?.toFixed(2)}) voice=${isVoice}`);
  }

  return { streamRecordId, streamSaveFailed };
}

/**
 * Pulls context, invokes the Vanguard Oracle edge function, logs chat messages and returns the Oracle reply.
 */
export async function queryOracle(
  cleanText: string,
  mode: string,
  chatId: number,
  ctx: TelegramRouterContext,
): Promise<string> {
  const { supabase, telegramToken, deepseekApiKey, vanguardUserId, supabaseUrl, supabaseServiceRoleKey } = ctx;

  await sendChatAction(telegramToken, chatId, "typing");

  const { data: historyData } = await supabase.from('ai_chat_messages')
    .select('role, content').eq('user_id', vanguardUserId)
    .order('created_at', { ascending: false }).limit(10);

  const oracleHistory = (historyData || []).reverse();

  const todayWarsawDate = getWarsawDateString();
  const sevenDaysAgoDate = getWarsawDateString(new Date(new Date(`${todayWarsawDate}T12:00:00Z`).getTime() - 7 * 86400000));
  const sevenDaysAgo = getWarsawDayBoundaries(sevenDaysAgoDate).start;

  const [aggregateRes, workoutRes, winRes, ouraRes, notesRes] = await Promise.all([
    supabase.from('vanguard_daily_aggregates').select('final_state, sleep_hours, hrv_avg, execution_score, dopamine_load_index').eq('user_id', vanguardUserId).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_sessions').select('created_at, workout_day').eq('user_id', vanguardUserId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_wins').select('task_1, done_1, task_2, done_2, task_3, done_3, task_4, done_4, task_5, done_5, result').eq('user_id', vanguardUserId).eq('date', todayWarsawDate).maybeSingle(),
    supabase.from('oura_daily_summary').select('date, total_sleep_hours, bedtime_timestamp, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes').eq('user_id', vanguardUserId).order('date', { ascending: false }).limit(3),
    supabase.from('vanguard_notes').select('title, content, created_at').eq('user_id', vanguardUserId).eq('is_archived', false).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5)
  ]);

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
    ...(notesRes.data?.length ? { recent_keep_notes: notesRes.data } : {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let data: any = null;
  let error: any = null;
  try {
    const oracleRes = await fetch(`${supabaseUrl}/functions/v1/vanguard-oracle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceRoleKey}`, 'apikey': supabaseServiceRoleKey },
      body: JSON.stringify({
        current_query: cleanText, user_id: vanguardUserId, state_vector: stateVector,
        mode: mode === 'report' ? 'mirror' : 'chat',
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
    return `⚠️ Oracle Error: ${errorDetail}`;
  }

  let raw = (data?.text || "") as string;
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!raw) {
    console.error(`[telegram] oracle returned empty text — data keys: ${data ? Object.keys(data).join(',') : 'null'}`);
    return "⚠️ Oracle: pusta odpowiedź modelu. Spróbuj jeszcze raz.";
  }

  const chatInsertRes = await supabase.from('ai_chat_messages').insert([
    { user_id: vanguardUserId, role: 'user', content: cleanText },
    { user_id: vanguardUserId, role: 'assistant', content: raw }
  ]);
  if (chatInsertRes.error) {
    console.error('[telegram] ai_chat_messages insert error:', chatInsertRes.error);
  } else {
    const { data: oldMsgs } = await supabase.from('ai_chat_messages').select('id').eq('user_id', vanguardUserId).order('created_at', { ascending: false }).range(200, 9999);
    if (oldMsgs && oldMsgs.length > 0) {
      await supabase.from('ai_chat_messages').delete().in('id', oldMsgs.map((m: any) => m.id))
        .then(({ error: e }: any) => { if (e) console.error('[telegram] ai_chat_messages trim error:', e); });
    }
  }

  return raw;
}
