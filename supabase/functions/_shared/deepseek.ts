export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekChatParams {
  apiKey: string;
  messages: DeepSeekMessage[];
  model?: string;
  maxTokens?: number | null;
  temperature?: number | null;
  timeoutMs?: number;
  responseFormat?: { type: 'json_object' };
}

export interface DeepSeekChatResult {
  content: string;
  raw: unknown;
}

export async function deepseekChat(
  params: DeepSeekChatParams,
): Promise<DeepSeekChatResult> {
  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 45000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? "deepseek-v4-flash",
        messages: params.messages,
        ...(params.maxTokens === null ? {} : { max_tokens: params.maxTokens ?? 500 }),
        ...(params.temperature === null ? {} : { temperature: params.temperature ?? 0.2 }),
        ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`DeepSeek error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const raw = await res.json();
    const content: string = (raw as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content || "";

    return { content, raw };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parseJsonFromContent(content: string): Record<string, unknown> | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
