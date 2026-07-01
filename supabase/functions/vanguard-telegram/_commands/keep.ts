import { safeSendTelegram } from "../_utils/helpers.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

export async function handleKeepCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
  fromVoice = false,
): Promise<void> {
  try {
    const content = text.trim();
    if (!content) {
      await safeSendTelegram(chatId, '❌ Pusta notatka.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const firstLine = content.split('\n')[0].slice(0, 80);
    const tags = fromVoice ? ['telegram', 'voice'] : ['telegram'];

    const { error } = await supabase.from('vanguard_notes').insert({
      user_id: vanguardUserId,
      title: firstLine,
      content,
      tags,
    });
    if (error) throw error;

    const label = fromVoice ? '🎤 Głosówka zapisana w Keep' : '📒 Notatka zapisana w Keep';
    await safeSendTelegram(chatId, `${label}\n"${firstLine}"`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /keep failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu notatki: ' + (err as Error).message, telegramToken);
  }
}
