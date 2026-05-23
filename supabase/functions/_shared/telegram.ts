export interface SendMessageOptions {
  parseMode?: string;
  disableNotification?: boolean;
  replyMarkup?: unknown;
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

  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

export function escapeMd(text: string): string {
  return text.replace(/[_*[\]`]/g, (c) => "\\" + c);
}
