import type { TelegramRouterContext } from "./config.ts";
import { answerCallbackQuery, clearInlineKeyboard, editMessageText } from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";

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
import {
  handleTodoCaptureCallback,
  isTodoCaptureCallback,
} from "../_handlers/todoCapture.ts";

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

  if (isTodoCaptureCallback(data)) {
    await handleTodoCaptureCallback(data, chatId, messageId, callbackId, supabase, telegramToken, vanguardUserId);
    return;
  }

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

  if (data.startsWith("save_claim_")) {
    const { handleSaveClaimCallback } = await import("../_handlers/saveClaim.ts");
    await handleSaveClaimCallback(
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

  if (data.startsWith("more_action:")) {
    const action = data.substring("more_action:".length);
    await answerCallbackQuery(telegramToken, callbackId);
    
    if (action === "lenie") {
      const { handleInteractivePromptCommand } = await import("../_commands/interactive.ts");
      await handleInteractivePromptCommand("🛋️ lenie", chatId, telegramToken);
    } else if (action === "post") {
      const { handleInteractivePromptCommand } = await import("../_commands/interactive.ts");
      await handleInteractivePromptCommand("⏳ post", chatId, telegramToken);
    } else if (action === "dieta") {
      const { handleDietaCommand } = await import("../_commands/dieta.ts");
      await handleDietaCommand(chatId, telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey, vanguardUserId);
    } else if (action === "wywiad") {
      const { handlePytanieCommand } = await import("../_commands/pytanie.ts");
      await handlePytanieCommand(chatId, telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
    } else if (action === "koniec") {
      const { handleKoniecCommand } = await import("../_commands/koniec.ts");
      await handleKoniecCommand(chatId, telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
    }
    return;
  }

  if (data.startsWith("undo:note:")) {
    const noteId = data.slice("undo:note:".length);
    const { error } = await supabase.from("vanguard_notes").delete().eq("id", noteId).eq("user_id", vanguardUserId);
    if (error) {
      console.error("[telegram] note undo failed:", error);
      await answerCallbackQuery(telegramToken, callbackId, { text: "Nie udało się cofnąć." });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId, { text: "Cofnięto zapis notatki." });
    await editMessageText(telegramToken, chatId, messageId, "• Cofnięto", [], { direct: true });
    return;
  }

  if (data.startsWith("undo:stream:")) {
    const streamId = data.slice("undo:stream:".length);
    const { error } = await supabase.from("vanguard_stream").delete().eq("id", streamId).eq("user_id", vanguardUserId);
    if (error) {
      console.error("[telegram] stream undo failed:", error);
      await answerCallbackQuery(telegramToken, callbackId, { text: "Nie udało się cofnąć." });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId, { text: "Cofnięto zapis." });
    await editMessageText(telegramToken, chatId, messageId, "• Cofnięto", [], { direct: true });
    return;
  }

  if (data.startsWith("show_text:note:")) {
    const noteId = data.slice("show_text:note:".length);
    const { data: note, error } = await supabase.from("vanguard_notes").select("content").eq("id", noteId).maybeSingle();
    if (error || !note) {
      await answerCallbackQuery(telegramToken, callbackId, { text: "Nie znaleziono notatki." });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId);
    await editMessageText(
      telegramToken,
      chatId,
      messageId,
      `✓ Zapisano notatkę (głosowo)\n\n${note.content}`,
      [[{ text: "Cofnij", callback_data: `undo:note:${noteId}` }]],
      { direct: true }
    );
    return;
  }

  if (data.startsWith("show_text:stream:")) {
    const streamId = data.slice("show_text:stream:".length);
    const { data: stream, error } = await supabase.from("vanguard_stream").select("content").eq("id", streamId).maybeSingle();
    if (error || !stream) {
      await answerCallbackQuery(telegramToken, callbackId, { text: "Nie znaleziono zapisu." });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId);
    await editMessageText(
      telegramToken,
      chatId,
      messageId,
      `✓ Zapisano głosówkę\n\n${stream.content}`,
      [[{ text: "Cofnij", callback_data: `undo:stream:${streamId}` }]],
      { direct: true }
    );
    return;
  }

  if (data.startsWith("retry_inbox:")) {
    const recId = data.slice("retry_inbox:".length);
    const { data: record, error } = await supabase.from("vanguard_telegram_inbox").select("*").eq("id", recId).maybeSingle();
    if (error || !record) {
      await answerCallbackQuery(telegramToken, callbackId, { text: "Nie znaleziono wiadomości." });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId, { text: "Ponawiam próbę..." });
    const innerPayload = record.payload;
    const message = innerPayload.message;
    if (message) {
      await clearInlineKeyboard(telegramToken, chatId, messageId);
      const { handleIncomingMessage } = await import("./messages.ts");
      await handleIncomingMessage(message as never, ctx);
    }
    return;
  }

  if (data.startsWith("save_as_note:")) {
    const recId = data.slice("save_as_note:".length);
    const { data: record, error } = await supabase.from("vanguard_telegram_inbox").select("*").eq("id", recId).maybeSingle();
    if (error || !record) {
      await answerCallbackQuery(telegramToken, callbackId, { text: "Nie znaleziono wiadomości." });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId, { text: "Zapisuję jako notatkę..." });
    const innerPayload = record.payload;
    const message = innerPayload.message;
    if (message) {
      await clearInlineKeyboard(telegramToken, chatId, messageId);
      const textContent = message.text || "";
      const { handleKeepCommand } = await import("../_commands/keep.ts");
      await handleKeepCommand(textContent, chatId, telegramToken, supabase, vanguardUserId, false);
    }
    return;
  }

  if (data.startsWith("oracle_clarify:")) {
    const msgId = parseInt(data.split(":")[1], 10);
    await answerCallbackQuery(telegramToken, callbackId);
    await safeSendTelegram(chatId, "• **Zadaj pytanie Wyroczni**\nNapisz swoje pytanie do Vanguard Oracle:", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoje pytanie..."
      }
    });
    return;
  }

  if (data.startsWith("oracle_more:")) {
    const msgId = parseInt(data.split(":")[1], 10);
    const { data: events } = await supabase
      .from("audit_events")
      .select("id, metadata")
      .eq("user_id", vanguardUserId)
      .eq("event_type", "pending_claim_proposal")
      .eq("metadata->>telegram_message_id", msgId.toString());

    const inlineKeyboard: any[][] = [
      [
        { text: "👍 Odpowiedź pomogła", callback_data: `fb_ok_${msgId}` },
        { text: "👎 Popraw mnie", callback_data: `fb_err_${msgId}` }
      ]
    ];

    if (events && events.length > 0) {
      for (const ev of events) {
        if (ev.metadata?.status === "pending" && ev.metadata?.claim?.text) {
          const claimText = ev.metadata.claim.text;
          const cleanText = claimText.length > 35 ? claimText.substring(0, 32) + "..." : claimText;
          inlineKeyboard.push([
            { text: `💾 Zapisz: "${cleanText}"`, callback_data: `save_claim_${ev.id}` }
          ]);
        }
      }
    }

    await answerCallbackQuery(telegramToken, callbackId);
    const { editMessageReplyMarkup } = await import("../../_shared/infra/telegram/send.ts");
    await editMessageReplyMarkup(telegramToken, chatId, messageId, { inline_keyboard: inlineKeyboard }, { direct: true });
    return;
  }

  console.warn("[telegram] unknown callback_data:", data);
  // Telegram shows a spinning loader on the tapped button for up to 10s if the callback
  // is never answered — always acknowledge it, even for an unrecognized action.
  await answerCallbackQuery(telegramToken, callbackId, { text: "⚠️ Nieznana akcja" });
}
