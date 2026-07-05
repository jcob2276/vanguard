import { safeSendTelegram } from "../_utils/helpers.ts";
import { answerCallbackQuery, editMessageText } from "../../_shared/telegram.ts";
import { getWarsawDateString } from "../../_shared/time.ts";

const QTY_OPTIONS = [1, 2, 3, 5];

export async function handleSuplementCommand(
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
): Promise<void> {
  const { data: supls, error } = await supabase
    .from('supplements')
    .select('slug, name, emoji')
    .eq('user_id', vanguardUserId)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error || !supls || supls.length === 0) {
    await safeSendTelegram(chatId, '💊 Brak aktywnych suplementów w bazie.', telegramToken);
    return;
  }

  const rows = [];
  for (let i = 0; i < supls.length; i += 2) {
    rows.push(
      supls.slice(i, i + 2).map((s: any) => ({
        text: `${s.emoji || '💊'} ${s.name}`,
        callback_data: `supl_s_${s.slug}`,
      }))
    );
  }

  await safeSendTelegram(chatId, '💊 Co wziąłeś?', telegramToken, {
    reply_markup: { inline_keyboard: rows },
  });
}

export function isSupplementCallback(data: string): boolean {
  return data.startsWith('supl_s_') || data.startsWith('supl_q_');
}

export async function handleSupplementCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  vanguardUserId: string,
): Promise<void> {
  if (data.startsWith('supl_s_')) {
    const slug = data.slice('supl_s_'.length);

    const { data: supl, error: fetchErr } = await supabase
      .from('supplements')
      .select('*')
      .eq('user_id', vanguardUserId)
      .eq('slug', slug)
      .maybeSingle();

    if (fetchErr || !supl) {
      console.error(`[supplements] not found: ${slug}`, fetchErr?.message);
      await answerCallbackQuery(telegramToken, callbackId, { text: '⚠️ Nieznany suplement' });
      return;
    }

    if (supl.skip_qty) {
      try {
        await logSupplementById(supabase, vanguardUserId, supl.id, 1);
      } catch (err) {
        await answerCallbackQuery(telegramToken, callbackId, { text: '❌ Błąd zapisu' });
        return;
      }
      await answerCallbackQuery(telegramToken, callbackId, { text: '✅ Zalogowano!' });
      await editMessageText(telegramToken, chatId, messageId, `✅ ${supl.emoji || '💊'} ${supl.name} — 1 ${supl.unit || 'porcja'}`);
      return;
    }

    const qtyRow = QTY_OPTIONS.map(q => ({
      text: `${q}x`,
      callback_data: `supl_q_${slug}_${q}`,
    }));

    await answerCallbackQuery(telegramToken, callbackId);
    await editMessageText(telegramToken, chatId, messageId, `${supl.emoji || '💊'} ${supl.name} — ile?`, [qtyRow]);
    return;
  }

  if (data.startsWith('supl_q_')) {
    const rest = data.slice('supl_q_'.length);
    const lastUnderscore = rest.lastIndexOf('_');
    const slug = rest.slice(0, lastUnderscore);
    const qty = parseInt(rest.slice(lastUnderscore + 1), 10);

    const { data: supl, error: fetchErr } = await supabase
      .from('supplements')
      .select('*')
      .eq('user_id', vanguardUserId)
      .eq('slug', slug)
      .maybeSingle();

    if (fetchErr || !supl || isNaN(qty)) {
      console.error(`[supplements] callback error: ${slug}`, fetchErr?.message);
      await answerCallbackQuery(telegramToken, callbackId, { text: '⚠️ Błąd' });
      return;
    }

    try {
      await logSupplementById(supabase, vanguardUserId, supl.id, qty);
    } catch (err) {
      await answerCallbackQuery(telegramToken, callbackId, { text: '❌ Błąd zapisu' });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId, { text: '✅ Zalogowano!' });
    await editMessageText(telegramToken, chatId, messageId, `✅ ${supl.emoji || '💊'} ${supl.name} — ${qty}x ${supl.unit || 'szt'}`);
  }
}

async function logSupplementById(
  supabase: any,
  userId: string,
  supplementId: string,
  quantity: number,
): Promise<void> {
  const today = getWarsawDateString();

  const { error } = await supabase.from('supplement_logs').insert({
    user_id: userId,
    supplement_id: supplementId,
    quantity,
    date: today,
  });

  if (error) {
    console.error('[supplements] insert failed:', error.message);
    throw new Error('Insert failed');
  }
}
