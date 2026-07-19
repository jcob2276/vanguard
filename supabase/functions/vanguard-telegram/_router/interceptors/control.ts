import { handleForceReplyReply, checkIdempotency } from "../messageHelpers.ts";
import { MessageContext, MessageInterceptor, tryResumeStuckReconciliationVoice } from "../interceptors.ts";

// 3. ForceReply handling for text messages
export class ForceReplyInterceptor implements MessageInterceptor {
  name = "ForceReplyInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    // Only text ForceReply unless it's a voice message replying to something other than Vanguard Keep
    if (ctx.isVoice) {
      const replyToText = ctx.message.reply_to_message?.text || "";
      if (replyToText.includes("Notatka") || replyToText.includes("Vanguard Keep")) {
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
        const { handleSavedLink } = await import("../../_handlers/savedLinks.ts");
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
