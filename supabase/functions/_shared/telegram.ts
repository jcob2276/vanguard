export interface SendMessageOptions {
  parseMode?: string;
  disableNotification?: boolean;
  replyMarkup?: unknown;
}

export type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  description?: string;
};

/** sendMessage + parse Telegram JSON (for message_id / error handling). */
export async function sendMessageParsed(
  token: string,
  chatId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TelegramSendResult> {
  const res = await sendMessage(token, chatId, text, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const description = data.description || `HTTP ${res.status}`;
    console.error("[telegram] send failed:", description, data);
    return { ok: false, description };
  }
  return { ok: true, messageId: data.result?.message_id };
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

  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, { signal: AbortSignal.timeout(15000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendChatAction(
  token: string,
  chatId: number,
  action: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, { signal: AbortSignal.timeout(15000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch((err) => {
    console.warn("[telegram] sendChatAction failed:", err);
  });
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  options: { text?: string; showAlert?: boolean } = {},
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { signal: AbortSignal.timeout(15000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: options.text ?? "",
      show_alert: options.showAlert,
    }),
  }).catch((err) => {
    console.warn("[telegram] answerCallbackQuery failed:", err);
  });
}

async function editMessageReplyMarkup(
  token: string,
  chatId: number,
  messageId: number,
  replyMarkup: unknown = { inline_keyboard: [] },
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, { signal: AbortSignal.timeout(15000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    }),
  }).catch((err) => {
    console.warn("[telegram] editMessageReplyMarkup failed:", err);
  });
}

/** Remove inline keyboard from a message. */
export async function clearInlineKeyboard(
  token: string,
  chatId: number,
  messageId: number,
): Promise<void> {
  await editMessageReplyMarkup(token, chatId, messageId);
}

/** Telegram Bot API getFile — for voice / file download in webhook handlers. */
async function getTelegramFilePath(
  token: string,
  fileId: string,
): Promise<string> {
  const fileRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
  );
  const fileData = await fileRes.json();
  if (!fileData.ok) {
    throw new Error("Nie udało się pobrać ścieżki pliku z Telegrama");
  }
  return fileData.result.file_path as string;
}

function telegramFileUrl(token: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

export async function transcribeAudio(
  fileId: string,
  telegramToken: string,
  openAiKey: string,
  options?: { timeoutMs?: number },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 30000;
  const filePath = await getTelegramFilePath(telegramToken, fileId);
  const fileUrl = telegramFileUrl(telegramToken, filePath);

  if (!fileUrl.startsWith("https://api.telegram.org/")) {
    throw new Error("Invalid file URL - potential SSRF");
  }

  const downloadController = new AbortController();
  const downloadTimeoutId = setTimeout(() => downloadController.abort(), timeoutMs);
  let audioBlob: Blob;
  try {
    const audioRes = await fetch(fileUrl, { signal: downloadController.signal });
    audioBlob = await audioRes.blob();
  } finally {
    clearTimeout(downloadTimeoutId);
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "voice.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "pl");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAiKey}` },
    body: formData,
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!whisperRes.ok) {
    const errText = await whisperRes.text().catch(() => 'unknown');
    throw new Error(`Whisper HTTP error (${whisperRes.status}): ${errText.substring(0, 200)}`);
  }
  const whisperData = await whisperRes.json();
  if (whisperData.error) throw new Error(`Whisper Error: ${whisperData.error.message}`);

  return whisperData.text;
}
