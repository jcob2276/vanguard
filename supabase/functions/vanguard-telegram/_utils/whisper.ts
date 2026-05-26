/**
 * whisper.ts — Transkrypcja głosówek Telegram → tekst via OpenAI Whisper.
 */

import { getTelegramFilePath, telegramFileUrl } from "../../_shared/telegram.ts";

export async function transcribeAudio(fileId: string, telegramToken: string, openAiKey: string): Promise<string> {
  const filePath = await getTelegramFilePath(telegramToken, fileId);
  const fileUrl = telegramFileUrl(telegramToken, filePath);

  if (!fileUrl.startsWith("https://api.telegram.org/")) {
    throw new Error("Invalid file URL - potential SSRF");
  }

  const audioRes = await fetch(fileUrl);
  const audioBlob = await audioRes.blob();

  const formData = new FormData();
  formData.append("file", audioBlob, "voice.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "pl");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
