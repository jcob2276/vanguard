import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

export async function handlePostCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
): Promise<void> {
  try {
    let dateStr = getWarsawDateString();
    let note = text.slice('/post'.length).trim() || null;

    if (note) {
      const firstWord = note.split(/\s+/)[0].toLowerCase();
      if (firstWord === 'wczoraj') {
        const dYesterday = new Date(dateStr);
        dYesterday.setDate(dYesterday.getDate() - 1);
        dateStr = dYesterday.toISOString().split('T')[0];
        note = note.slice('wczoraj'.length).trim() || null;
      } else if (firstWord === 'dzis' || firstWord === 'dziś') {
        note = note.slice(firstWord.length).trim() || null;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(firstWord)) {
        dateStr = firstWord;
        note = note.slice(10).trim() || null;
      }
    }

    const { error } = await supabase.from('fasting_logs').upsert(
      { user_id: vanguardUserId, date: dateStr, note, created_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    if (error) throw error;
    await safeSendTelegram(chatId, `🔵 Post zapisany (${dateStr})${note ? `\nOpis: ${note}` : ''}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /post failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu postu: ' + (err as Error).message, telegramToken);
  }
}
