import type { TelegramRouterContext } from "./config.ts";
import { answerCallbackQuery, clearInlineKeyboard } from "../../_shared/telegram.ts";
import {
  ANALYSIS_ACTION_CALLBACKS,
  handleAnalysisActionCallback,
} from "../_handlers/antiAnalysis.ts";
import { handlePlanningCallback } from "../_handlers/planning.ts";
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
  const {
    supabase,
    telegramToken,
    deepseekApiKey,
    vanguardUserId,
  } = ctx;

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


  if (data.startsWith("planning_")) {
    await handlePlanningCallback(
      data,
      chatId,
      messageId,
      callbackId,
      supabase,
      telegramToken,
      deepseekApiKey,
      vanguardUserId,
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

  if (data === 'briefing_ok') {
    await answerCallbackQuery(telegramToken, callbackId, { text: '✅ Zapisane' });
    await clearInlineKeyboard(telegramToken, chatId, messageId);
    return;
  }

  console.warn("[telegram] unknown callback_data:", data);
  // Telegram shows a spinning loader on the tapped button for up to 10s if the callback
  // is never answered — always acknowledge it, even for an unrecognized action.
  await answerCallbackQuery(telegramToken, callbackId, { text: "⚠️ Nieznana akcja" });
}
