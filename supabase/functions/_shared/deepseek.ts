interface DeepSeekMessage {
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
  reasoning_content?: string;
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
    const content: string = (raw as any)?.choices?.[0]?.message?.content || "";
    const reasoning_content: string | undefined = (raw as any)?.choices?.[0]?.message?.reasoning_content;

    return { content, reasoning_content, raw };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function deepseekStream(
  params: DeepSeekChatParams,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 45000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model ?? "deepseek-v4-flash",
      messages: params.messages,
      stream: true,
      ...(params.maxTokens === null ? {} : { max_tokens: params.maxTokens ?? 500 }),
      ...(params.temperature === null ? {} : { temperature: params.temperature ?? 0.2 }),
    }),
    signal: controller.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepSeek error (${res.status}): ${errText.slice(0, 200)}`);
  }

  // Clear timeout to prevent aborting after initial headers arrive
  clearTimeout(timeoutId);
  return res;
}

export function parseJsonFromContent(content: string): Record<string, unknown> | null {
  // Brace-depth scan (string-aware) instead of a greedy /\{[\s\S]*\}/ match — the greedy
  // regex spans from the first "{" to the LAST "}" in the whole string, so trailing prose
  // with its own "}", or two separate JSON objects in one response, produced one unparseable
  // blob instead of the first valid object. This returns just the first balanced top-level
  // object, correctly skipping over braces inside string values.
  const start = content.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(content.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
