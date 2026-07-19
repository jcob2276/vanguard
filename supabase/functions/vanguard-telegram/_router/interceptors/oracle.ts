import { queryOracle } from "../messageHelpers.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../../_utils/constants.ts";
import { safeSendTelegram } from "../../_utils/helpers.ts";
import { logCriticalError } from "../../../_shared/errorLogging.ts";
import { MessageContext, MessageInterceptor } from "../interceptors.ts";

// 12. Oracle response (Fallback) and background trigger
export class OracleResponseInterceptor implements MessageInterceptor {
  name = "OracleResponseInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    let responseText = "";
    let inlineKeyboard: any[][] = [];
    let showReceiptButtons = false;

    if (!ctx.shouldRespond) {
      if (ctx.isVoice && ctx.streamRecordId && !ctx.streamSaveFailed) {
        const durationSec = ctx.voiceAttachment?.duration || 0;
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        responseText = `✓ Zapisano głosówkę · ${durationStr}`;
        showReceiptButtons = true;
      } else {
        responseText =
          ctx.mode === "knowledge"
            ? "📖 Zapisano w wiedzy (przez kontrolowany ingest)."
            : ctx.mode === "daily_reconciliation_response"
            ? "✅ Refleksja zapisana."
            : ctx.streamSaveFailed
            ? "❌ Błąd zapisu — wiadomość nie została zachowana. Spróbuj ponownie."
            : ""; // No filler — silence means success
      }

      // Nothing to say and no error — exit silently
      if (!responseText) return true;
    } else {
      responseText = await queryOracle(ctx.cleanText, ctx.mode, ctx.chatId, ctx);
    }

    if (ctx.handlerResponded) {
      console.log("[telegram] handler already responded — skipping final responseText send");
      return true;
    }

    const hasButtons = ctx.shouldRespond && !responseText.startsWith("⚠️");
    if (hasButtons) {
      const row: any[] = [];
      if (ctx.resolvedClaims && ctx.resolvedClaims.length > 0) {
        row.push({ text: "Zastosuj", callback_data: `save_claim_${ctx.resolvedClaims[0].id}` });
      }
      row.push({ text: "Dopytaj", callback_data: `oracle_clarify:${ctx.messageId}` });
      row.push({ text: "•••", callback_data: `oracle_more:${ctx.messageId}` });
      inlineKeyboard.push(row);
    } else if (showReceiptButtons) {
      inlineKeyboard.push([
        { text: "Pokaż tekst", callback_data: `show_text:stream:${ctx.streamRecordId}` },
        { text: "Cofnij", callback_data: `undo:stream:${ctx.streamRecordId}` }
      ]);
    }

    const telegramPayload = {
      chat_id: ctx.chatId,
      text: responseText,
      disable_notification: !ctx.shouldRespond,
      reply_markup: (hasButtons || showReceiptButtons)
        ? { inline_keyboard: inlineKeyboard }
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
