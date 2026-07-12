import type { TelegramRouterContext } from "./config.ts";
import { getEmbedding } from "../../_shared/openai.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { getReconciliationById } from "../../_shared/repos/reconciliationsRepo.ts";
import { getStreamByTelegramMessageId } from "../../_shared/repos/streamRepo.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import {
  handleTodoCommand,
  handleKeepCommand,
  handlePosilekCommand,
} from "./commands.ts";
export { queryOracle } from "./oracleCaller.ts";

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
  if (promptText.includes("Pytanie pogłębiające")) {
    const { handleClarificationReply } = await import("../_handlers/clarification.ts");
    const handled = await handleClarificationReply(promptText, text, ctx, chatId);
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
    const existing = await getStreamByTelegramMessageId(supabase, messageId);

    if (existing) {
      const reconId = (existing.metadata as { reconciliation_id?: string } | null)?.reconciliation_id;
      if (reconId && existing.content) {
        const recon = await getReconciliationById(supabase, reconId);
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
        emotionData = parseJsonFromContent(emotionRes.content || '{}') as { valence: number; arousal: number; state: string; energy_level?: number; stress_level?: number } | null;
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
