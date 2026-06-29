import { safeSendTelegram } from "../_utils/helpers.ts";
import { answerCallbackQuery } from "../../_shared/telegram.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_router/commands.ts";
import { getWarsawDateString } from "../../_shared/time.ts";

const SUPPLEMENTS = [
  { slug: 'd3k2',      label: '☀️ D3+K2',       skipQty: false },
  { slug: 'omega3',    label: '🐟 Omega-3',      skipQty: false },
  { slug: 'kreatyna',  label: '⚡ Kreatyna',      skipQty: true  }, // zawsze 1 porcja 5g
  { slug: 'lionsmane', label: '🍄 Lion\'s Mane', skipQty: false },
  { slug: 'cynk',      label: '💊 Cynk',         skipQty: false },
];

const QTY_OPTIONS = [1, 2, 3, 5];

export async function handleSuplementCommand(
  chatId: number,
  telegramToken: string,
): Promise<void> {
  const rows = [];
  for (let i = 0; i < SUPPLEMENTS.length; i += 2) {
    rows.push(
      SUPPLEMENTS.slice(i, i + 2).map(s => ({
        text: s.label,
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
    const supl = SUPPLEMENTS.find(s => s.slug === slug);
    if (!supl) {
      await answerCallbackQuery(telegramToken, callbackId, { text: '⚠️ Nieznany suplement' });
      return;
    }

    if (supl.skipQty) {
      try {
        await logSupplement(supabase, vanguardUserId, slug, 1);
      } catch (err) {
        await answerCallbackQuery(telegramToken, callbackId, { text: '❌ Błąd zapisu' });
        return;
      }
      await answerCallbackQuery(telegramToken, callbackId, { text: '✅ Zalogowano!' });
      await editMessage(telegramToken, chatId, messageId, `✅ ${supl.label} — 1 porcja (5g)`);
      return;
    }

    const qtyRow = QTY_OPTIONS.map(q => ({
      text: `${q}x`,
      callback_data: `supl_q_${slug}_${q}`,
    }));

    await answerCallbackQuery(telegramToken, callbackId);
    await editMessage(telegramToken, chatId, messageId, `${supl.label} — ile?`, [qtyRow]);
    return;
  }

  if (data.startsWith('supl_q_')) {
    const rest = data.slice('supl_q_'.length);
    const lastUnderscore = rest.lastIndexOf('_');
    const slug = rest.slice(0, lastUnderscore);
    const qty = parseInt(rest.slice(lastUnderscore + 1), 10);
    const supl = SUPPLEMENTS.find(s => s.slug === slug);

    if (!supl || isNaN(qty)) {
      await answerCallbackQuery(telegramToken, callbackId, { text: '⚠️ Błąd' });
      return;
    }

    try {
      await logSupplement(supabase, vanguardUserId, slug, qty);
    } catch (err) {
      await answerCallbackQuery(telegramToken, callbackId, { text: '❌ Błąd zapisu' });
      return;
    }
    await answerCallbackQuery(telegramToken, callbackId, { text: '✅ Zalogowano!' });
    await editMessage(telegramToken, chatId, messageId, `✅ ${supl.label} — ${qty}x`);
  }
}

async function logSupplement(
  supabase: any,
  userId: string,
  slug: string,
  quantity: number,
): Promise<void> {
  const today = getWarsawDateString();

  const { data: supl, error: fetchErr } = await supabase
    .from('supplements')
    .select('id')
    .eq('user_id', userId)
    .eq('slug', slug)
    .single();

  if (fetchErr || !supl?.id) {
    console.error(`[supplements] not found: ${slug}`, fetchErr?.message);
    throw new Error('Suplement nie znaleziony');
  }

  const { error } = await supabase.from('supplement_logs').insert({
    user_id: userId,
    supplement_id: supl.id,
    quantity,
    date: today,
  });

  if (error) {
    console.error('[supplements] insert failed:', error.message);
    throw new Error('Insert failed');
  }
}

async function editMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  inlineKeyboard?: object[][],
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
  if (inlineKeyboard) {
    body.reply_markup = { inline_keyboard: inlineKeyboard };
  } else {
    body.reply_markup = { inline_keyboard: [] };
  }
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}
