import { sendChatAction, transcribeAudio } from "../../../_shared/telegram.ts";
import { handleKeepCommand } from "../commands.ts";
import { MessageContext, MessageInterceptor, tryResumeStuckReconciliationVoice } from "../interceptors.ts";

// 1. Photo handling
export class PhotoInterceptor implements MessageInterceptor {
  name = "PhotoInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const photo = ctx.message.photo;
    if (photo && photo.length > 0) {
      const { handlePhotoLabel } = await import("../../_handlers/photoLabel.ts");
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

    await sendChatAction(ctx.telegramToken, ctx.chatId, "record_voice", { direct: true });

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
