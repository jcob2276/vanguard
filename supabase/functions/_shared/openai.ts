/**
 * Shared OpenAI helpers.
 */

type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: OpenAIMessageContent;
}

export interface OpenAIChatParams {
  apiKey: string;
  messages: OpenAIMessage[];
  model?: string;
  maxTokens?: number | null;
  temperature?: number | null;
  timeoutMs?: number;
  responseFormat?: { type: 'json_object' };
}

export interface OpenAIChatResult {
  content: string;
  raw: unknown;
}

/** Centralized OpenAI chat-completions call (text or vision) — mirrors deepseekChat's shape. */
export async function openaiChat(params: OpenAIChatParams): Promise<OpenAIChatResult> {
  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 45000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? "gpt-4o-mini",
        messages: params.messages,
        ...(params.maxTokens === null ? {} : { max_tokens: params.maxTokens ?? 500 }),
        ...(params.temperature === null ? {} : { temperature: params.temperature ?? 0.2 }),
        ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const raw = await res.json();
    const content: string = (raw as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content || "";

    return { content, raw };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Centralized Whisper transcription — takes a raw audio Blob (already fetched/uploaded).
 *  Callers that need to fetch audio from Telegram first (transcribeAudio in
 *  _shared/infra/telegram/send.ts) or receive a File from a form upload
 *  (vanguard-capture) both delegate the actual OpenAI call here. */
export async function transcribeBlob(
  audioBlob: Blob,
  apiKey: string,
  opts?: { filename?: string; language?: string; timeoutMs?: number },
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 30000);
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, opts?.filename ?? "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", opts?.language ?? "pl");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`Whisper HTTP error (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(`Whisper Error: ${data.error.message}`);
    return data.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getEmbedding(text: string | string[], apiKey: string): Promise<number[] | number[][] | null> {
  if (!apiKey) {
    console.error("[OpenAI] Missing API key for embedding generation.");
    return null;
  }
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", { signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: Array.isArray(text) ? text : text.replace(/\n/g, " ").slice(0, 8000),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[OpenAI] Embedding HTTP error (${res.status}): ${errText.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(text)) {
      return data.data?.map((d: any) => d.embedding) ?? null;
    }
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error("[OpenAI] Embedding exception caught:", err);
    return null;
  }
}
