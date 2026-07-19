import { sendChatAction } from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { sendFoodParseResult } from "../_handlers/foodMeal.ts";
import type { ParsedFoodItem } from "../../_shared/foodParseCore.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

function defaultMealTypeWarsaw(): string {
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }));
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

async function callParseFoodNl(
  rawText: string,
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<ParsedFoodItem[]> {
  const res = await fetch(`${supabaseUrl}/functions/v1/parse-food-nl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: rawText, userId }),
    signal: AbortSignal.timeout(35000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `parse-food-nl HTTP ${res.status}`);
  }
  const body = await res.json();
  return Array.isArray(body.items) ? body.items as ParsedFoodItem[] : [];
}

export async function handlePosilekCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
  _deepseekApiKey: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Promise<void> {
  try {
    const raw = text.replace(/^\/posilek\s*/i, '').trim();
    if (!raw) {
      await safeSendTelegram(chatId, '! Napisz co zjadłeś, np. "/posilek makaron z serkiem tłustym piątnica".', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    await sendChatAction(telegramToken, chatId, 'typing', { direct: true });

    const items = await callParseFoodNl(raw, vanguardUserId, supabaseUrl, supabaseServiceRoleKey);
    if (items.length === 0) {
      await safeSendTelegram(chatId, '! Nie udało się rozpoznać posiłku, spróbuj opisać inaczej.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const today = getWarsawDateString();
    const mealType = defaultMealTypeWarsaw();

    await sendFoodParseResult(items, {
      chatId,
      telegramToken,
      supabase,
      userId: vanguardUserId,
      date: today,
      mealType,
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    });
  } catch (err) {
    console.error('[commands] /posilek failed:', err);
    await safeSendTelegram(chatId, '! Nie udało się zapisać posiłku.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}
