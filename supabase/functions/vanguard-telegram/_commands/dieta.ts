import { sendChatAction } from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

export async function handleDietaCommand(
  chatId: number,
  telegramToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
  vanguardUserId: string,
): Promise<void> {
  try {
    await sendChatAction(telegramToken, chatId, "typing");

    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-nutrition-coach`, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({ userId: vanguardUserId, notify: true })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    if (!body?.notified) {
      await safeSendTelegram(chatId, '⚠️ Policzone, ale push się nie wysłał. Spróbuj jeszcze raz.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
    }
  } catch (err) {
    console.error('[commands] /dieta trigger failed:', err);
    await safeSendTelegram(chatId, 'Nie udało się policzyć diety: ' + (err as Error).message, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}
