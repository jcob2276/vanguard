import { handleReconciliation } from "../../_handlers/reconciliation.ts";
import { MessageContext, MessageInterceptor } from "../interceptors.ts";

// 8. Reconciliation context detector
export class ReconciliationContextInterceptor implements MessageInterceptor {
  name = "ReconciliationContextInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const hasCommandPrefix = /^(\?|!!|##|@|poprawka:)/i.test(ctx.text.trim());

    if (!hasCommandPrefix && (ctx.mode === "stream" || ctx.mode === "chat")) {
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
          ctx.shouldRespond = true; // Oracle responds even during reconciliation
          ctx.mode = "daily_reconciliation_response";
          ctx.cleanText = ctx.text.trim();
        }
      }
    }

    if (ctx.isVoice) {
      if (ctx.mode === "daily_reconciliation_response") {
        // During reconciliation: save to DB via ReconciliationSaverInterceptor
        // AND let Oracle respond — voice is the most valuable signal of the day
        ctx.shouldRespond = true;
        ctx.cleanText = ctx.text.trim();
        // mode stays "daily_reconciliation_response" so ReconciliationSaverInterceptor fires
      } else {
        // All other voice → Oracle responds, always
        ctx.shouldRespond = true;
        ctx.mode = "chat";
        ctx.cleanText = ctx.text.replace(/^(pytanie|wyrocznia)\s*[:,-]?\s*/i, "").trim();
      }
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
      // Only block Oracle if shouldRespond=false (non-voice text during reconciliation)
      // Voice messages continue to Oracle for a real response
      if (!ctx.shouldRespond) {
        ctx.handlerResponded = true;
      }
    }
    return false;
  }
}
