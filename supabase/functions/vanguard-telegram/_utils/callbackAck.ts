import {
  answerCallbackQuery,
  clearInlineKeyboard,
} from "../../_shared/telegram.ts";

/** Acknowledge callback and strip inline keyboard (standard button flow). */
export async function ackCallback(
  token: string,
  callbackId: string,
  chatId: number,
  messageId: number,
  answerText = "",
): Promise<void> {
  await answerCallbackQuery(token, callbackId, { text: answerText });
  await clearInlineKeyboard(token, chatId, messageId);
}
