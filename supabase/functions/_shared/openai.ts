/**
 * Shared OpenAI helpers.
 */

export type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface OpenAIMessage {
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
