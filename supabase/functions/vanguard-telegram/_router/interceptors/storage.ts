import { insertStreamRecord } from "../messageHelpers.ts";
import { runAntiAnalysisGuard } from "../../_handlers/antiAnalysis.ts";
import { inferVaultCategory } from "../../_utils/helpers.ts";
import { logAuditEvent } from "../../../_shared/audit.ts";
import { MessageContext, MessageInterceptor } from "../interceptors.ts";

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

      // For free-form messages (mode='chat'), store as 'stream' in the DB
      // to keep metadata consistent — mode='chat' is a routing decision, not a stream type
      const dbMode = ctx.mode === "chat" ? "stream" : ctx.mode;
      const streamRes = await insertStreamRecord(
        ctx.cleanText,
        dbMode,
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
      (ctx.mode === "stream" || ctx.mode === "chat") &&
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
