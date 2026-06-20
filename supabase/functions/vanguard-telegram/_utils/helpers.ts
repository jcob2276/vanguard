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

export function extractDayScore(text: string): number | null {
  const normalized = text.toLowerCase();
  const explicit = normalized.match(/(?:ocena(?:\s+dnia)?|dzie[nń]\s+na|oceniam(?:\s+dzie[nń])?):?\s*([1-5])(?:\s*\/\s*5)?/i);
  if (explicit?.[1]) return Number(explicit[1]);

  const numberedAnswer = normalized.match(/(?:^|\n|\s)4[).\:-]\s*([1-5])(?:\s*\/\s*5)?/i);
  if (numberedAnswer?.[1]) return Number(numberedAnswer[1]);

  return null;
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
  return result.ok;
}
