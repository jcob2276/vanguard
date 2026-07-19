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

const TG_LIMIT = 4000; // leave 96 chars margin below Telegram's 4096

function chunkText(text: string): string[] {
  if (text.length <= TG_LIMIT) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TG_LIMIT) {
    // prefer splitting at a newline boundary within the limit
    let cutAt = remaining.lastIndexOf('\n', TG_LIMIT);
    if (cutAt < TG_LIMIT * 0.5) cutAt = TG_LIMIT; // no good newline, hard cut
    chunks.push(remaining.slice(0, cutAt).trimEnd());
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function safeSendTelegram(
  chatId: number,
  text: string,
  token: string,
  options: { reply_markup?: unknown; disable_notification?: boolean; parse_mode?: string } = {},
): Promise<boolean> {
  // Safe SPLIT: only split on [SPLIT] that is surrounded by whitespace (or at string edges).
  // This prevents accidentally splitting inside Markdown links or URLs
  // where [SPLIT] would never appear with surrounding spaces.
  const parts = text.split(/[ \t]*\[SPLIT\][ \t]*/).map(p => p.trim()).filter(Boolean);
  let allOk = true;

  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const partText = parts[pIdx];
    const isLastPart = pIdx === parts.length - 1;
    const chunks = chunkText(partText);

    for (let i = 0; i < chunks.length; i++) {
      const isLast = isLastPart && (i === chunks.length - 1);

      const result = await sendMessageParsed(token, chatId, chunks[i], {
        parseMode: options.parse_mode,
        disableNotification: options.disable_notification,
        replyMarkup: isLast ? options.reply_markup : undefined,
      });

      if (result.ok) continue;

      // Retry without parse_mode on Markdown entity error
      if (options.parse_mode) {
        console.warn('[telegram] send with parse_mode failed, retrying as plain text:', result.description);
        const retry = await sendMessageParsed(token, chatId, chunks[i], {
          disableNotification: options.disable_notification,
          replyMarkup: isLast ? options.reply_markup : undefined,
        });
        if (!retry.ok) allOk = false;
      } else {
        allOk = false;
      }
    }
  }

  return allOk;
}
