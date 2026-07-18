import { answerCallbackQuery, clearInlineKeyboard } from '../../_shared/telegram.ts';

const PREFIX = 'todo_undo:';

export function isTodoCaptureCallback(data: string): boolean {
  return data.startsWith(PREFIX);
}

export async function handleTodoCaptureCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  userId: string,
): Promise<void> {
  const todoId = data.slice(PREFIX.length);
  if (!todoId) {
    await answerCallbackQuery(telegramToken, callbackId, { text: 'Brak zadania do cofnięcia.' });
    return;
  }

  const { error } = await supabase
    .from('todo_items')
    .delete()
    .eq('id', todoId)
    .eq('user_id', userId);
  if (error) {
    console.error('[telegram] todo undo failed:', error);
    await answerCallbackQuery(telegramToken, callbackId, { text: 'Nie udało się cofnąć.' });
    return;
  }

  await answerCallbackQuery(telegramToken, callbackId, { text: 'Cofnięto dodanie zadania.' });
  await clearInlineKeyboard(telegramToken, chatId, messageId);
}

