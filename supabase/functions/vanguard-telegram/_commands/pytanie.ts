import { sendChatAction } from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

export async function handlePytanieCommand(
  chatId: number,
  telegramToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Promise<void> {
  try {
    await sendChatAction(telegramToken, chatId, "typing");
    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-eval-interview`, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({ manual: true })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }

    if (body?.skipped) {
      await safeSendTelegram(chatId, `⚠️ Wywiad pominięty: ${body.reason}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
    }
  } catch (err) {
    console.error('[commands] /pytanie trigger failed:', err);
    await safeSendTelegram(chatId, 'Nie udalo sie odpalic wywiadu: ' + (err as Error).message, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}
