/**
 * helpers.ts — Drobne utility functions dla vanguard-telegram.
 */

import { sendMessageParsed } from "../../_shared/telegram.ts";

export function inferVaultCategory(text: string): string {
  const head = text.slice(0, 700).toLowerCase();
  const explicit = head.match(/(?:kategoria|category)\s*:\s*([a-ząćęłńóśźż0-9_-]+)/i);
  if (explicit?.[1]) return explicit[1]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();

  if (/dziecinstw|dzieciństw|rodzin|mama|tata|ojciec|matka|brat|siostr|babci/.test(head)) return "family_childhood";
  if (/relacj|dziewczyn|zwiazk|związk|randk|bliskosc|bliskość|seks/.test(head)) return "relationships";
  if (/pieniadz|pieniądz|kasa|zarab|sprzedaz|sprzedaż|biznes|praca/.test(head)) return "money_work";
  if (/cial|ciał|zdrow|sen|oura|trening|silown|siłown|jedzenie|energia/.test(head)) return "body_health";
  if (/wizj|marz|cel|przyszlosc|przyszłość|chce byc|chcę być/.test(head)) return "future_vision";
  if (/szkol|studia|nauka|egzamin|poraż|poraz|sukces/.test(head)) return "school_history";
  return "telegram_vault";
}

export function getWarsawDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

export async function safeSendTelegram(
  chatId: number,
  text: string,
  token: string,
  options: { reply_markup?: unknown; disable_notification?: boolean; parse_mode?: string } = {},
): Promise<boolean> {
  const result = await sendMessageParsed(token, chatId, text, {
    parseMode: options.parse_mode,
    disableNotification: options.disable_notification,
    replyMarkup: options.reply_markup,
  });
  if (result.ok) return true;

  // Telegram rejects the whole message on unbalanced Markdown entities (e.g. a stray
  // "*" or "_" in LLM-generated text). Retry once as plain text instead of dropping the
  // message entirely — the user seeing literal asterisks is much better than no reply.
  if (options.parse_mode) {
    console.warn('[telegram] send with parse_mode failed, retrying as plain text:', result.description);
    const retry = await sendMessageParsed(token, chatId, text, {
      disableNotification: options.disable_notification,
      replyMarkup: options.reply_markup,
    });
    return retry.ok;
  }

  return false;
}
