import {
  answerCallbackQuery,
  clearInlineKeyboard,
} from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import type { TelegramRouterContext } from "../_router/config.ts";

export function isFeedbackCallback(data: string): boolean {
  return data.startsWith("fb_ok") || data.startsWith("fb_err");
}

export async function handleFeedbackCallback(
  data: string,
  message: { message_id: number; text?: string; reply_to_message?: { text?: string } },
  chatId: number,
  callbackId: string,
  ctx: TelegramRouterContext,
): Promise<void> {
  const isOk = data.startsWith("fb_ok");
  const score = isOk ? 1 : -1;

  await ctx.supabase.from("vanguard_feedback").insert({
    user_id: ctx.vanguardUserId,
    message_id: message.message_id.toString(),
    query: message.reply_to_message?.text || "Unknown",
    reply: message.text,
    score,
    metadata: { callback_data: data },
  });

  if (isOk) {
    const { data: lastKnowledge } = await ctx.supabase
      .from("vanguard_knowledge")
      .select("id")
      .eq("user_id", ctx.vanguardUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastKnowledge) {
      await ctx.supabase
        .from("vanguard_knowledge")
        .update({ is_verified: true })
        .eq("id", lastKnowledge.id);
    }
  }

  await answerCallbackQuery(ctx.telegramToken, callbackId, {
    text: isOk
      ? "✅ Przyjęte. Vanguard uczy się..."
      : "❌ Zanotowano błąd. Napisz poprawkę.",
  });
  await clearInlineKeyboard(
    ctx.telegramToken,
    chatId,
    message.message_id,
  );

  if (!isOk) {
    await safeSendTelegram(
      chatId,
      "📝 Napisz mi teraz: 'Poprawka: [prawdziwa informacja]', abym mógł to zapisać na stałe.",
      ctx.telegramToken,
    );
  }
}
