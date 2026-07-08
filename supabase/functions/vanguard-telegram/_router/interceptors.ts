import { sendChatAction, transcribeAudio } from "../../_shared/telegram.ts";
import { inferVaultCategory, safeSendTelegram } from "../_utils/helpers.ts";
import { handleReconciliation } from "../_handlers/reconciliation.ts";
import { runAntiAnalysisGuard } from "../_handlers/antiAnalysis.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { logAuditEvent } from "../../_shared/audit.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import {
  handleStartMenuCommand,
  handleKoniecCommand,
  handlePytanieCommand,
  handleDietaCommand,
  handleInteractivePromptCommand,
  handlePostCommand,
  handleLenieCommand,
  handleTodoCommand,
  handleKeepCommand,
  handlePosilekCommand,
} from "./commands.ts";
import { handleSuplementCommand } from "../_handlers/supplements.ts";
import {
  handleForceReplyReply,
  checkIdempotency,
  insertStreamRecord,
  queryOracle,
} from "./messageHelpers.ts";
import type { TelegramRouterContext } from "./config.ts";

type VoiceLikeAttachment = { file_id: string; duration?: number };

export interface MessageContext extends TelegramRouterContext {
  message: {
    text?: string;
    voice?: VoiceLikeAttachment;
    audio?: VoiceLikeAttachment & { mime_type?: string };
    message_id: number;
    chat: { id: number };
    reply_to_message?: { text?: string };
    photo?: any[];
  };
  chatId: number;
  messageId: number;
  isVoice: boolean;
  voiceAttachment: VoiceLikeAttachment | null;

  // Mutable pipeline state passed between interceptors
  text: string;
  mode: string;
  cleanText: string;
  shouldRespond: boolean;
  streamRecordId: string | null;
  deferredVaultIngest: { text: string; category: string } | null;
  pendingReconciliation: {
    id: string;
    date: string;
    mode?: string;
    parsed_response?: { mode?: string; [key: string]: unknown };
  } | null;
  streamSaveFailed: boolean;
  handlerResponded: boolean;
}

interface MessageInterceptor {
  name: string;
  handle(ctx: MessageContext): Promise<boolean>;
}

export function buildInitialContext(
  message: MessageContext["message"],
  routerCtx: TelegramRouterContext,
): MessageContext {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const voiceAttachment = getVoiceLikeAttachment(message);
  const isVoice = !!voiceAttachment;
  const text = message.text || "";

  return {
    ...routerCtx,
    message,
    chatId,
    messageId,
    isVoice,
    voiceAttachment,
    text,
    mode: "stream",
    cleanText: text,
    shouldRespond: false,
    streamRecordId: null,
    deferredVaultIngest: null,
    pendingReconciliation: null,
    streamSaveFailed: false,
    handlerResponded: false,
  };
}

function getVoiceLikeAttachment(message: MessageContext["message"]): VoiceLikeAttachment | null {
  if (message.voice?.file_id) return message.voice;
  if (!message.audio?.file_id) return null;

  const mime = (message.audio.mime_type || "").toLowerCase();
  if (
    !mime ||
    mime.includes("ogg") ||
    mime.includes("opus") ||
    mime.includes("mpeg") ||
    mime.includes("mp4") ||
    mime.includes("m4a")
  ) {
    return { file_id: message.audio.file_id, duration: message.audio.duration };
  }

  return null;
}

async function tryResumeStuckReconciliationVoice(
  messageId: number,
  chatId: number,
  ctx: Pick<TelegramRouterContext, "supabase" | "telegramToken" | "deepseekApiKey" | "supabaseUrl" | "supabaseServiceRoleKey" | "vanguardUserId">,
): Promise<boolean> {
  const { supabase, telegramToken, deepseekApiKey, supabaseUrl, supabaseServiceRoleKey, vanguardUserId } = ctx;

  const { data: existing } = await supabase
    .from("vanguard_stream")
    .select("id, content, metadata")
    .eq("metadata->>telegram_message_id", messageId.toString())
    .maybeSingle();

  if (!existing?.content) return false;

  const reconId = (existing.metadata as { reconciliation_id?: string } | null)?.reconciliation_id;
  if (!reconId) return false;

  const { data: recon } = await supabase
    .from("daily_reconciliations")
    .select("id, date, status")
    .eq("id", reconId)
    .maybeSingle();

  if (recon?.status !== "sent") return false;

  await safeSendTelegram(
    chatId,
    "⏳ Wznawiam analizę refleksji...",
    telegramToken,
    { disable_notification: true },
  );

  await handleReconciliation(
    recon.id,
    String(existing.content),
    existing.id,
    chatId,
    supabase,
    telegramToken,
    deepseekApiKey,
    supabaseUrl,
    supabaseServiceRoleKey,
    vanguardUserId,
    recon.date,
  );
  return true;
}

function looksLikeTodoCapture(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 180) return false;
  if (/https?:\/\//.test(t)) return false;
  if (/^(\?|!!|##|@|poprawka:)/i.test(t)) return false;
  if (/^\/\w/.test(t)) return false;
  if (/(^|\s)(p[1-4])(?=\s|$)/i.test(t)) return true;
  if (/(^|\s)(jutro|pojutrze|dzisiaj|dziś|dzis)(?=\s|$)/i.test(t)) return true;
  if (/^\+/.test(t) || /\s\+(jutro|tydz)/i.test(t)) return true;
  if (/!high|!low|pilne/i.test(t)) return true;
  return false;
}

// 1. Photo handling
export class PhotoInterceptor implements MessageInterceptor {
  name = "PhotoInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const photo = ctx.message.photo;
    if (photo && photo.length > 0) {
      const { handlePhotoLabel } = await import("../_handlers/photoLabel.ts");
      await handlePhotoLabel(
        photo,
        ctx.chatId,
        ctx.telegramToken,
        ctx.openAiKey,
        ctx.vanguardUserId,
        ctx.supabase,
      );
      return true;
    }
    return false;
  }
}

// 2. Transcription handling for voice/audio
export class TranscriptionInterceptor implements MessageInterceptor {
  name = "TranscriptionInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    if (!ctx.isVoice) return false;

    await sendChatAction(ctx.telegramToken, ctx.chatId, "record_voice");
    await safeSendTelegram(
      ctx.chatId,
      "🎤 Słucham...",
      ctx.telegramToken,
      { disable_notification: true },
    );

    if (await tryResumeStuckReconciliationVoice(ctx.messageId, ctx.chatId, ctx)) {
      return true;
    }

    const { data: reconciliation } = await ctx.supabase
      .from("daily_reconciliations")
      .select("id, date, created_at")
      .eq("user_id", ctx.vanguardUserId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reconciliation) {
      const ageMs = Date.now() - new Date(reconciliation.created_at).getTime();
      if (ageMs >= 0 && ageMs <= 6 * 60 * 60 * 1000) {
        ctx.pendingReconciliation = reconciliation;
      }
    }

    ctx.text = await transcribeAudio(
      ctx.voiceAttachment!.file_id,
      ctx.telegramToken,
      ctx.openAiKey,
      ctx.pendingReconciliation ? { timeoutMs: 22000 } : undefined,
    );
    ctx.cleanText = ctx.text;

    // ForceReply intercept Keep before stream recording
    const replyTo = ctx.message.reply_to_message;
    if (replyTo?.text && ctx.text) {
      if (replyTo.text.includes("Vanguard Keep")) {
        await handleKeepCommand(
          ctx.text,
          ctx.chatId,
          ctx.telegramToken,
          ctx.supabase,
          ctx.vanguardUserId,
          true,
        );
        return true;
      }
    }

    return false;
  }
}

// 3. ForceReply handling for text messages
export class ForceReplyInterceptor implements MessageInterceptor {
  name = "ForceReplyInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    // Only text ForceReply unless it's a voice message replying to something other than Vanguard Keep
    if (ctx.isVoice) {
      const replyToText = ctx.message.reply_to_message?.text || "";
      if (replyToText.includes("Vanguard Keep")) {
        return false; // Handled by TranscriptionInterceptor
      }
    }

    const replyTo = ctx.message.reply_to_message;
    if (replyTo && replyTo.text && ctx.text) {
      const handled = await handleForceReplyReply(replyTo.text, ctx.text, ctx.chatId, ctx);
      if (handled) return true;

      // Mutate prefix based on prompt for fallback
      if (replyTo.text.includes("Zadaj pytanie Wyroczni")) {
        ctx.text = `? ${ctx.text}`;
        ctx.cleanText = ctx.text;
      } else if (replyTo.text.includes("Wpisz poprawkę do wiedzy")) {
        ctx.text = `poprawka: ${ctx.text}`;
        ctx.cleanText = ctx.text;
      }
    }
    return false;
  }
}

// 4. Idempotency check
export class IdempotencyInterceptor implements MessageInterceptor {
  name = "IdempotencyInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const { exists: isDuplicate, shouldStop } = await checkIdempotency(
      ctx.messageId,
      ctx.chatId,
      ctx,
      tryResumeStuckReconciliationVoice,
    );
    if (isDuplicate) {
      return shouldStop;
    }
    return false;
  }
}

// 5. URL detection / Saved Link handling
export class SavedLinkInterceptor implements MessageInterceptor {
  name = "SavedLinkInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const hasCommandPrefix = /^(\?|!!|##|@|poprawka:)/i.test(ctx.text.trim());
    if (!hasCommandPrefix && ctx.text && /https?:\/\/[^\s]+/.test(ctx.text)) {
      try {
        const { handleSavedLink } = await import("../_handlers/savedLinks.ts");
        const handled = await handleSavedLink(
          ctx.chatId,
          ctx.text,
          ctx.telegramToken,
          ctx.deepseekApiKey,
          ctx.vanguardUserId,
          ctx.supabase,
          ctx.messageId,
        );
        if (handled) return true;
      } catch (err) {
        console.error("[interceptors] Saved link handler failed:", err);
      }
    }
    return false;
  }
}

// 6. Router for slash commands and menu items
export class CommandRouterInterceptor implements MessageInterceptor {
  name = "CommandRouterInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    let cleanText = ctx.text;
    let shouldRespond = false;
    let mode = "stream";

    if (ctx.text.startsWith("?")) {
      shouldRespond = true;
      mode = "chat";
      cleanText = ctx.text.substring(1).trim();
    } else if (ctx.text.startsWith("!!")) {
      shouldRespond = true;
      mode = "deep";
      cleanText = ctx.text.substring(2).trim();
    } else if (ctx.text.startsWith("##")) {
      shouldRespond = false;
      mode = "knowledge";
      cleanText = ctx.text.substring(2).trim();
    } else if (ctx.text.startsWith("@")) {
      shouldRespond = true;
      mode = "report";
      cleanText = ctx.text.substring(1).trim();
    } else if (ctx.text.toLowerCase().startsWith("poprawka:")) {
      shouldRespond = false;
      mode = "knowledge";
      cleanText = ctx.text;
    }

    ctx.mode = mode;
    ctx.shouldRespond = shouldRespond;
    ctx.cleanText = cleanText;

    const lowerText = ctx.text.toLowerCase().trim();

    if (lowerText === "/start" || lowerText === "/menu") {
      await handleStartMenuCommand(ctx.chatId, ctx.telegramToken);
      return true;
    }
    if (lowerText === "/koniec" || lowerText === "🔚 koniec") {
      await handleKoniecCommand(ctx.chatId, ctx.telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
      return true;
    }
    if (lowerText === "/pytanie" || lowerText === "💬 pytanie") {
      await handlePytanieCommand(ctx.chatId, ctx.telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
      return true;
    }
    if (lowerText === "/dieta" || lowerText === "🍽️ dieta" || lowerText === "dieta") {
      await handleDietaCommand(ctx.chatId, ctx.telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey, ctx.vanguardUserId);
      return true;
    }
    if (await handleInteractivePromptCommand(lowerText, ctx.chatId, ctx.telegramToken)) {
      return true;
    }
    if (lowerText.startsWith("/post")) {
      await handlePostCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId);
      return true;
    }
    if (lowerText.startsWith("/posilek") || lowerText.startsWith("/posiłek")) {
      await handlePosilekCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId, ctx.deepseekApiKey, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
      return true;
    }
    if (lowerText.startsWith("/lenie")) {
      await handleLenieCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId);
      return true;
    }
    if (lowerText.startsWith("/todo")) {
      await handleTodoCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId, ctx.deepseekApiKey);
      return true;
    }
    if (lowerText === "/s" || lowerText === "/suplement" || lowerText === "💊 suple") {
      await handleSuplementCommand(ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId);
      return true;
    }
    if (lowerText.startsWith("/keep") || lowerText.startsWith("/notatka")) {
      const sliceLen = lowerText.startsWith("/keep") ? 5 : 8;
      await handleKeepCommand(ctx.text.slice(sliceLen).trim(), ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId, false);
      return true;
    }
    if (lowerText.startsWith("/librarian")) {
      await safeSendTelegram(ctx.chatId, "⏳ Uruchamiam Agenta Bibliotekarza...", ctx.telegramToken, { disable_notification: true });
      fetch(`${ctx.supabaseUrl}/functions/v1/vanguard-librarian`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ctx.supabaseServiceRoleKey}` },
      }).catch((err) => console.error("[telegram] /librarian invoke failed:", err));
      return true;
    }

    return false;
  }
}

// 7. Todo autocapture
export class TodoAutoCaptureInterceptor implements MessageInterceptor {
  name = "TodoAutoCaptureInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const hasCommandPrefix = /^(\?|!!|##|@|poprawka:)/i.test(ctx.text.trim());
    if (!hasCommandPrefix && looksLikeTodoCapture(ctx.text)) {
      await handleTodoCommand(
        ctx.text,
        ctx.chatId,
        ctx.telegramToken,
        ctx.supabase,
        ctx.vanguardUserId,
        ctx.deepseekApiKey,
      );
      return true;
    }
    return false;
  }
}

// 8. Reconciliation context detector
export class ReconciliationContextInterceptor implements MessageInterceptor {
  name = "ReconciliationContextInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const hasCommandPrefix = /^(\?|!!|##|@|poprawka:)/i.test(ctx.text.trim());

    if (!hasCommandPrefix && ctx.mode === "stream") {
      const { data: reconciliation } = await ctx.supabase
        .from("daily_reconciliations")
        .select("id, date, created_at, mode, parsed_response")
        .eq("user_id", ctx.vanguardUserId)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reconciliation) {
        const ageMs = Date.now() - new Date(reconciliation.created_at).getTime();
        if (ageMs >= 0 && ageMs <= 6 * 60 * 60 * 1000) {
          ctx.pendingReconciliation = {
            id: reconciliation.id,
            date: reconciliation.date,
            mode: reconciliation.mode,
            parsed_response: reconciliation.parsed_response,
          };
          ctx.shouldRespond = false;
          ctx.mode = "daily_reconciliation_response";
          ctx.cleanText = ctx.text.trim();
        }
      }
    }

    if (ctx.isVoice) {
      const transcriptWordCount = ctx.text.trim().split(/\s+/).filter(Boolean).length;
      const transcriptStartsChat = /^(pytanie|wyrocznia|\?)/i.test(ctx.text.trim());
      if (transcriptStartsChat) {
        ctx.pendingReconciliation = null;
        ctx.shouldRespond = true;
        ctx.mode = "chat";
        ctx.cleanText = ctx.text.replace(/^(pytanie|wyrocznia)\s*[:,-]?\s*/i, "").trim();
      } else {
        ctx.shouldRespond = false;
        ctx.cleanText = ctx.text.trim();
        if (ctx.mode === "daily_reconciliation_response") {
          ctx.cleanText = ctx.text.trim();
        }
        ctx.mode = transcriptWordCount > 200 ? "knowledge" : "stream";
      }
    }

    return false;
  }
}

// 9. Stream record writer
export class StreamWriterInterceptor implements MessageInterceptor {
  name = "StreamWriterInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    if (ctx.mode !== "knowledge") {
      const voiceDurationSec = ctx.voiceAttachment?.duration || 0;
      let voiceWpm: number | null = null;
      if (ctx.isVoice && voiceDurationSec > 0) {
        const wordCount = ctx.cleanText.trim().split(/\s+/).filter(Boolean).length;
        voiceWpm = Math.round(wordCount / (voiceDurationSec / 60));
      }

      const streamRes = await insertStreamRecord(
        ctx.cleanText,
        ctx.mode,
        ctx.isVoice,
        voiceDurationSec,
        voiceWpm,
        ctx.pendingReconciliation,
        ctx.chatId,
        ctx.messageId,
        ctx,
      );
      ctx.streamRecordId = streamRes.streamRecordId;
      ctx.streamSaveFailed = streamRes.streamSaveFailed;
    }

    // Anti-analysis guard
    const hasCommandPrefix = /^(\?|!!|##|@|poprawka:)/i.test(ctx.text.trim());
    if (
      ctx.mode === "stream" &&
      !hasCommandPrefix &&
      !ctx.pendingReconciliation &&
      ctx.cleanText.length >= 120
    ) {
      const intercepted = await runAntiAnalysisGuard(
        ctx.cleanText,
        ctx.chatId,
        ctx.supabase,
        ctx.telegramToken,
        ctx.deepseekApiKey,
        ctx.vanguardUserId,
      );
      if (intercepted) return true;
    }

    return false;
  }
}

// 10. Reconciliation processor
export class ReconciliationSaverInterceptor implements MessageInterceptor {
  name = "ReconciliationSaverInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    if (ctx.pendingReconciliation) {
      await handleReconciliation(
        ctx.pendingReconciliation.id,
        ctx.cleanText,
        ctx.streamRecordId,
        ctx.chatId,
        ctx.supabase,
        ctx.telegramToken,
        ctx.deepseekApiKey,
        ctx.supabaseUrl,
        ctx.supabaseServiceRoleKey,
        ctx.vanguardUserId,
        ctx.pendingReconciliation.date,
      );
      ctx.handlerResponded = true;
    }
    return false;
  }
}

// 11. Knowledge / corrections saver
export class KnowledgeSaverInterceptor implements MessageInterceptor {
  name = "KnowledgeSaverInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    if (ctx.mode !== "knowledge") return false;

    const lowerText = ctx.cleanText.toLowerCase();
    const isIdentityUpdate = lowerText.startsWith("poprawka tożsamość:");
    const isGeneralPoprawka = !isIdentityUpdate && lowerText.startsWith("poprawka:");

    let rawContent = ctx.cleanText;
    if (isIdentityUpdate) rawContent = ctx.cleanText.substring(19).trim();
    else if (isGeneralPoprawka) rawContent = ctx.cleanText.substring(9).trim();

    const isBehavioral =
      isGeneralPoprawka &&
      /(nie mów|nie pisz|nie zaczynaj|nie używaj|styl|ton|forma odpowiedzi|odpowiadaj|pisz do mnie|mów do mnie)/i.test(
        rawContent,
      );

    if (isBehavioral) {
      await ctx.supabase.from("vanguard_preferences").upsert(
        {
          user_id: ctx.vanguardUserId,
          key: "custom_style_" + Date.now(),
          value: rawContent,
        },
        { onConflict: "user_id, key" },
      );
    } else if (isIdentityUpdate) {
      await ctx.supabase
        .from("user_fundament")
        .upsert({ user_id: ctx.vanguardUserId, identity: rawContent }, { onConflict: "user_id" });
    } else {
      const wordCount = rawContent.trim().split(/\s+/).filter(Boolean).length;
      const category = isGeneralPoprawka ? "lesson" : inferVaultCategory(rawContent);

      if (wordCount > 80 || isGeneralPoprawka) {
        ctx.deferredVaultIngest = { text: rawContent, category };

        logAuditEvent({
          eventType: "knowledge_ingest_deferred",
          severity: "info",
          message: isGeneralPoprawka
            ? "User correction routed via ingest-vault-log"
            : "Long vault note routed via proper path",
          metadata: { category, length: rawContent.length, source: "telegram" },
        }).catch((e: unknown) => console.warn("[telegram] audit log failed:", e));
      }
    }
    return false;
  }
}

// 12. Oracle response (Fallback) and background trigger
export class OracleResponseInterceptor implements MessageInterceptor {
  name = "OracleResponseInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    let responseText = "";
    if (!ctx.shouldRespond) {
      responseText =
        ctx.mode === "knowledge"
          ? "📖 Zapisano w wiedzy (przez kontrolowany ingest)."
          : ctx.mode === "daily_reconciliation_response"
          ? "✅ Refleksja zapisana."
          : ctx.streamSaveFailed
          ? "❌ Błąd zapisu — wiadomość nie została zachowana. Spróbuj ponownie."
          : "💭 Zapisano w Strumieniu.";
    } else {
      responseText = await queryOracle(ctx.cleanText, ctx.mode, ctx.chatId, ctx);
    }

    if (ctx.handlerResponded) {
      console.log("[telegram] handler already responded — skipping final responseText send");
      return true;
    }

    const hasButtons = ctx.shouldRespond && !responseText.startsWith("⚠️");
    const telegramPayload = {
      chat_id: ctx.chatId,
      text: responseText,
      disable_notification: !ctx.shouldRespond,
      reply_markup: hasButtons
        ? {
            inline_keyboard: [
              [
                { text: "👍 Dobra odpowiedź", callback_data: `fb_ok_${Date.now()}` },
                { text: "👎 Popraw mnie", callback_data: `fb_err_${Date.now()}` },
              ],
            ],
          }
        : DEFAULT_REPLY_KEYBOARD,
    };

    const isSent = await safeSendTelegram(ctx.chatId, responseText, ctx.telegramToken, {
      disable_notification: telegramPayload.disable_notification,
      reply_markup: telegramPayload.reply_markup,
    });

    if (!isSent) {
      console.error("[telegram] sendMessage failed, attempting fallback...");
      await safeSendTelegram(ctx.chatId, responseText.replace(/[<>&]/g, ""), ctx.telegramToken, {
        disable_notification: !ctx.shouldRespond,
        reply_markup: DEFAULT_REPLY_KEYBOARD,
      });
    }

    // Deferred background tasks (triggered at the end of the chain)
    if (ctx.deferredVaultIngest) {
      try {
        const { error: ingestError } = await ctx.supabase.functions.invoke("vanguard-capture", {
          body: {
            userId: ctx.vanguardUserId,
            text: ctx.deferredVaultIngest.text,
            category: ctx.deferredVaultIngest.category,
          },
        });
        if (ingestError) console.error("Long knowledge ingest failed:", ingestError);
      } catch (err) {
        await logCriticalError({
          area: "telegram-messages",
          error: err,
          message: "Long knowledge background ingest error",
          metadata: { nonFatal: true },
        });
      }
    }

    if (ctx.streamRecordId) {
      try {
        const { error: architectError } = await ctx.supabase.functions.invoke("vanguard-architect", {
          body: { type: "stream", record_id: ctx.streamRecordId, limit: 1 },
        });
        if (architectError) console.error("[telegram] architect invoke failed:", architectError);
      } catch (err) {
        await logCriticalError({
          area: "telegram-messages",
          error: err,
          message: "Architect background invoke error",
          metadata: { nonFatal: true },
        });
      }
    }

    return true;
  }
}
