/**
 * patternFeedback.ts
 *
 * Etap 1 — Prosty mechanizm feedbacku na wykryte wzorce behawioralne.
 * Użytkownik może potwierdzić, odrzucić lub wyciszyć konkretny insight.
 *
 * Callback format:
 *   pat_confirm_<curiosity_queue_id>
 *   pat_reject_<curiosity_queue_id>
 *   pat_snooze_<curiosity_queue_id>
 */

import {
  answerCallbackQuery,
  clearInlineKeyboard,
} from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import type { TelegramRouterContext } from "../_router/config.ts";
import { updatePatternFeedback } from "../../_shared/vanguardPatterns.ts";

export function isPatternFeedbackCallback(data: string): boolean {
  return data.startsWith("pat_confirm_") ||
         data.startsWith("pat_reject_") ||
         data.startsWith("pat_snooze_") ||
         data.startsWith("pat_exception_") ||
         data.startsWith("pat_deception_");
}

export async function handlePatternFeedbackCallback(
  data: string,
  message: { message_id: number },
  chatId: number,
  callbackId: string,
  ctx: TelegramRouterContext,
): Promise<void> {
  const { supabase, telegramToken, vanguardUserId } = ctx;

  let action: 'confirm' | 'reject' | 'snooze' | 'exception' | 'deception';
  if (data.startsWith("pat_confirm_")) action = 'confirm';
  else if (data.startsWith("pat_reject_")) action = 'reject';
  else if (data.startsWith("pat_snooze_")) action = 'snooze';
  else if (data.startsWith("pat_exception_")) action = 'exception';
  else action = 'deception';

  const patternId = data.replace(/^pat_(confirm|reject|snooze|exception|deception)_/, '');

  if (!patternId) {
    await answerCallbackQuery(telegramToken, callbackId, { text: "Błąd: brak ID wzorca" });
    return;
  }

  let userMessage = "";

  switch (action) {
    case 'confirm':
      userMessage = "✅ Zapisane. Wzorzec będzie ważniejszy w przyszłości.";
      break;
    case 'reject':
      userMessage = "👎 Zrozumiałem. Ten wzorzec zostanie mocno obniżony.";
      break;
    case 'snooze':
      userMessage = "⏸ Wyciszony na jakiś czas. Nie będę go pokazywał przez najbliższe dni.";
      break;
    case 'exception':
      userMessage = "✍️ Zapisane jako świadomy wybór / wyjątek.";
      break;
    case 'deception':
      userMessage = "🧠 Zarejestrowano jako samooszukiwanie.";
      break;
  }

  try {
    await updatePatternFeedback(supabase, vanguardUserId, patternId, action);
  } catch (err) {
    console.error("[patternFeedback] update failed:", err);
    await answerCallbackQuery(telegramToken, callbackId, {
      text: "Coś poszło nie tak przy zapisie.",
    });
    return;
  }

  await answerCallbackQuery(telegramToken, callbackId, {
    text: userMessage,
  });

  // Usuń przyciski z wiadomości (żeby nie dało się klikać wielokrotnie)
  await clearInlineKeyboard(telegramToken, chatId, message.message_id);
}
