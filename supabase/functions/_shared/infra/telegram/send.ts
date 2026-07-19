/**
 * @file infra/telegram/send.ts
 * @role WYJŚCIE: Funkcje wysyłania wiadomości, aktualizacji klawiatury i transkrypcji z Telegram Bot API.
 * @layer infra
 * @reads —
 * @writes —
 * @calls api.telegram.org, api.openai.com
 * @consumers vanguard-telegram, vanguard-nutrition-coach, sync, recap, vanguard-analyst
 */

import { createServiceClient } from "../../supabase.ts";
import { transcribeBlob } from "../../openai.ts";
import { fetchWithRetry } from "../../httpClient.ts";

export interface SendMessageOptions {
  parseMode?: string;
  disableNotification?: boolean;
  replyMarkup?: unknown;
  direct?: boolean;
}

export type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  description?: string;
};

// Helper function to queue outbound requests generic way
async function queueOutbox(method: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("outbound_messages").insert({
      chat_id: Number(body.chat_id),
      payload: { method, body }
    });
    if (error) {
      console.error(`[telegram] outbox insert error for ${method}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] outbox connection failed for ${method}:`, err);
    return false;
  }
}

/** Generic low-level Telegram Bot API call — any method, raw parsed JSON response.
 *  Used by vanguard-outbox-sender (dispatches whatever {method, body} was queued
 *  by queueOutbox above) so it doesn't need its own raw fetch to api.telegram.org. */
export async function callTelegramMethod(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string; result?: unknown }> {
  const res = await fetchWithRetry(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, { timeoutMs: 15000, retries: 1, logTag: `telegram.${method}` });
  const text = await res.text();
  let data: { ok: boolean; description?: string; result?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, description: text };
  }
  if (!res.ok && data.ok === undefined) data.ok = false;
  return data;
}

/** sendMessage + parse Telegram JSON (for message_id / error handling). */
export async function sendMessageParsed(
  token: string,
  chatId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TelegramSendResult> {
  if (options.direct) {
    let res = await sendMessage(token, chatId, text, options);
    let data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      if (options.parseMode) {
        console.warn("[telegram] send failed with parseMode, retrying as plain text...");
        res = await sendMessage(token, chatId, text, { ...options, parseMode: undefined });
        data = await res.json().catch(() => ({}));
      }
    }
    if (!res.ok || !data.ok) {
      const description = data.description || `HTTP ${res.status}`;
      console.error("[telegram] send failed:", description, data);
      return { ok: false, description };
    }
    return { ok: true, messageId: data.result?.message_id };
  }

  // Outbox path
  const queued = await queueOutbox("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode,
    disable_notification: options.disableNotification,
    reply_markup: options.replyMarkup,
  });

  return { ok: queued, messageId: 0 };
}

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<Response> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (options.parseMode) body.parse_mode = options.parseMode;
  if (options.disableNotification !== undefined) {
    body.disable_notification = options.disableNotification;
  }
  if (options.replyMarkup) body.reply_markup = options.replyMarkup;

  if (options.direct) {
    return fetchWithRetry(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, { timeoutMs: 15000, retries: 1, logTag: "telegram.sendMessage" });
  }

  // Queue to outbox
  const queued = await queueOutbox("sendMessage", body);
  return new Response(JSON.stringify({ ok: queued, result: { message_id: 0 } }), {
    status: queued ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}

export async function sendChatAction(
  token: string,
  chatId: number,
  action: string,
  options: { direct?: boolean } = {},
): Promise<void> {
  if (options.direct) {
    await fetchWithRetry(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    }, { timeoutMs: 15000, retries: 1, logTag: "telegram.sendChatAction" }).catch((err) => {
      console.warn("[telegram] sendChatAction failed:", err);
    });
    return;
  }

  await queueOutbox("sendChatAction", { chat_id: chatId, action });
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  options: { text?: string; showAlert?: boolean; direct?: boolean } = {},
): Promise<void> {
  // Always send answerCallbackQuery directly because Telegram has a strict <10s response window
  // (no retry here — a retry could push the response past that window).
  await fetchWithRetry(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: options.text ?? "",
      show_alert: options.showAlert,
    }),
  }, { timeoutMs: 8000, logTag: "telegram.answerCallbackQuery" }).catch((err) => {
    console.warn("[telegram] answerCallbackQuery failed:", err);
  });
}

export async function editMessageReplyMarkup(
  token: string,
  chatId: number,
  messageId: number,
  replyMarkup: unknown = { inline_keyboard: [] },
  options: { direct?: boolean } = {},
): Promise<void> {
  if (options.direct) {
    await fetchWithRetry(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      }),
    }, { timeoutMs: 15000, retries: 1, logTag: "telegram.editMessageReplyMarkup" }).catch((err) => {
      console.warn("[telegram] editMessageReplyMarkup failed:", err);
    });
    return;
  }

  await queueOutbox("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

/** Remove inline keyboard from a message. */
export async function clearInlineKeyboard(
  token: string,
  chatId: number,
  messageId: number,
  options: { direct?: boolean } = {},
): Promise<void> {
  await editMessageReplyMarkup(token, chatId, messageId, { inline_keyboard: [] }, options);
}

/** Edit a message's text (and optionally its inline keyboard). */
export async function editMessageText(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  inlineKeyboard?: object[][],
  options: { direct?: boolean } = {},
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
  body.reply_markup = { inline_keyboard: inlineKeyboard ?? [] };

  if (options.direct) {
    await fetchWithRetry(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, { timeoutMs: 10000, retries: 1, logTag: "telegram.editMessageText" });
    return;
  }

  await queueOutbox("editMessageText", body);
}

/** Telegram Bot API getFile — for voice / file download in webhook handlers. */
export async function getTelegramFilePath(
  token: string,
  fileId: string,
): Promise<string> {
  const fileRes = await fetchWithRetry(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
    {},
    { timeoutMs: 15000, retries: 1, logTag: "telegram.getFile" },
  );
  const fileData = await fileRes.json();
  if (!fileData.ok) {
    throw new Error("Nie udało się pobrać ścieżki pliku z Telegrama");
  }
  return fileData.result.file_path as string;
}

export function telegramFileUrl(token: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

// Download i transkrypcja mają osobne budżety: pobranie małego pliku z Telegrama jest zawsze
// szybkie (stały limit wystarcza), a Whisper dla dłuższej głosówki realnie potrzebuje więcej
// czasu niż na pobranie — jeden wspólny timeout (dawniej 30s na oba) ucinał transkrypcję
// dłuższych nagrań, mimo że samo pobranie już dawno się skończyło.
const VOICE_DOWNLOAD_TIMEOUT_MS = 15000;

export async function transcribeAudio(
  fileId: string,
  telegramToken: string,
  openAiKey: string,
  options?: { timeoutMs?: number },
): Promise<string> {
  const transcribeTimeoutMs = options?.timeoutMs ?? 30000;
  const filePath = await getTelegramFilePath(telegramToken, fileId);
  const fileUrl = telegramFileUrl(telegramToken, filePath);

  if (!fileUrl.startsWith("https://api.telegram.org/")) {
    throw new Error("Invalid file URL - potential SSRF");
  }

  const downloadController = new AbortController();
  const downloadTimeoutId = setTimeout(() => downloadController.abort(), VOICE_DOWNLOAD_TIMEOUT_MS);
  let audioBlob: Blob;
  try {
    const audioRes = await fetch(fileUrl, { signal: downloadController.signal });
    audioBlob = await audioRes.blob();
  } finally {
    clearTimeout(downloadTimeoutId);
  }

  return transcribeBlob(audioBlob, openAiKey, { filename: "voice.ogg", timeoutMs: transcribeTimeoutMs });
}

export async function setMessageReaction(
  token: string,
  chatId: number,
  messageId: number,
  emoji: string,
  options: { isBig?: boolean; direct?: boolean } = {},
): Promise<void> {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: "emoji", emoji }],
    is_big: options.isBig,
  };
  if (options.direct) {
    await fetchWithRetry(`https://api.telegram.org/bot${token}/setMessageReaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, { timeoutMs: 10000, retries: 1, logTag: "telegram.setMessageReaction" }).catch((err) => {
      console.warn("[telegram] setMessageReaction failed:", err);
    });
    return;
  }
  await queueOutbox("setMessageReaction", body);
}
