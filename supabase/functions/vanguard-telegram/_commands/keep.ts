import { safeSendTelegram } from "../_utils/helpers.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";
import { buildNoteInsertRow } from "@vanguard/domain";

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
      await safeSendTelegram(chatId, '! Pusta notatka.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const tags = fromVoice ? ['telegram', 'voice'] : ['telegram'];
    const payload = buildNoteInsertRow({
      user_id: vanguardUserId,
      content,
      tags,
    });

    const { data: note, error } = await supabase.from('vanguard_notes').insert(payload).select('id').single();
    if (error) throw error;

    const todayStr = getWarsawDateString();
    fetchWorldState(supabase, vanguardUserId, todayStr, undefined, true).catch((e) => {
      console.error("[telegram] fetchWorldState forceRefresh failed:", e);
    });

    const title = String(payload.title);
    const statusLine = fromVoice ? '✓ Zapisano notatkę (głosowo)' : '✓ Zapisano notatkę';
    const messageText = `${statusLine}\n\n${title}`;

    const inlineKeyboard = fromVoice
      ? [[
          { text: "Pokaż tekst", callback_data: `show_text:note:${note.id}` },
          { text: "Cofnij", callback_data: `undo:note:${note.id}` }
        ]]
      : [[
          { text: "Cofnij", callback_data: `undo:note:${note.id}` }
        ]];

    await safeSendTelegram(chatId, messageText, telegramToken, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } catch (err) {
    console.error('[commands] /keep failed:', err);
    await safeSendTelegram(chatId, '! Nie udało się zapisać notatki.', telegramToken);
  }
}
