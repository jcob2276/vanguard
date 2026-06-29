import type { TelegramRouterContext } from "./config.ts";
import { answerCallbackQuery } from "../../_shared/telegram.ts";
import {
  ANALYSIS_ACTION_CALLBACKS,
  handleAnalysisActionCallback,
} from "../_handlers/antiAnalysis.ts";
import {
  handleFeedbackCallback,
  isFeedbackCallback,
} from "../_handlers/feedback.ts";
import {
  handleClosureCallback,
  isClosureCallback,
} from "../_handlers/closureProposal.ts";
import {
  handlePatternFeedbackCallback,
  isPatternFeedbackCallback,
} from "../_handlers/patternFeedback.ts";
import {
  handleSupplementCallback,
  isSupplementCallback,
} from "../_handlers/supplements.ts";
import {
  handleFoodMealCallback,
  isFoodMealCallback,
} from "../_handlers/foodMeal.ts";

type CallbackQuery = {
  id: string;
  data: string;
  message: {
    chat: { id: number };
    message_id: number;
    text?: string;
    reply_to_message?: { text?: string };
  };
};

export async function handleCallbackQuery(
  callbackQuery: CallbackQuery,
  ctx: TelegramRouterContext,
): Promise<void> {
  const { id: callbackId, data, message } = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const { supabase, telegramToken, vanguardUserId } = ctx;

  if (isFoodMealCallback(data)) {
    await handleFoodMealCallback(
      data,
      chatId,
      messageId,
      callbackId,
      supabase,
      telegramToken,
      vanguardUserId,
    );
    return;
  }

  if (isSupplementCallback(data)) {
    await handleSupplementCallback(data, chatId, messageId, callbackId, supabase, telegramToken, vanguardUserId);
    return;
  }

  if (ANALYSIS_ACTION_CALLBACKS.includes(data)) {
    await handleAnalysisActionCallback(
      data,
      chatId,
      messageId,
      callbackId,
      telegramToken,
    );
    return;
  }

  if (isPatternFeedbackCallback(data)) {
    await handlePatternFeedbackCallback(
      data,
      message,
      chatId,
      callbackId,
      ctx,
    );
    return;
  }

  if (isFeedbackCallback(data)) {
    await handleFeedbackCallback(
      data,
      message,
      chatId,
      callbackId,
      ctx,
    );
    return;
  }

  if (isClosureCallback(data)) {
    await handleClosureCallback(
      data,
      chatId,
      messageId,
      callbackId,
      supabase,
      telegramToken,
    );
    return;
  }

  console.warn("[telegram] unknown callback_data:", data);
  // Telegram shows a spinning loader on the tapped button for up to 10s if the callback
  // is never answered — always acknowledge it, even for an unrecognized action.
  await answerCallbackQuery(telegramToken, callbackId, { text: "⚠️ Nieznana akcja" });
}
