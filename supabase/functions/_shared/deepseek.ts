import { createServiceClient } from "./supabase.ts";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
}

interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface DeepSeekTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface DeepSeekChatParams {
  apiKey: string;
  messages: DeepSeekMessage[];
  model?: string;
  maxTokens?: number | null;
  temperature?: number | null;
  timeoutMs?: number;
  responseFormat?: { type: 'json_object' };
  tools?: DeepSeekTool[];
  userId?: string;
  feature?: string;
}

export interface DeepSeekChatResult {
  content: string;
  reasoning_content?: string;
  tool_calls?: DeepSeekToolCall[];
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
        ...(params.tools ? { tools: params.tools } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`DeepSeek error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const raw = await res.json() as Record<string, unknown>;
    const msg = (raw.choices as Record<string, unknown>[])?.[0]?.message as Record<string, unknown> | undefined;
    const content: string = (msg?.content as string) || "";
    const reasoning_content: string | undefined = msg?.reasoning_content as string | undefined;
    const tool_calls: DeepSeekToolCall[] | undefined = msg?.tool_calls as DeepSeekToolCall[] | undefined;

    // Log LLM token usage and estimated cost to the database
    try {
      const usage = raw.usage as Record<string, unknown> | undefined;
      if (usage) {
        const promptTokens = Number(usage.prompt_tokens ?? 0);
        const completionTokens = Number(usage.completion_tokens ?? 0);
        const totalTokens = Number(usage.total_tokens ?? 0);
        const selectedModel = params.model ?? "deepseek-v4-flash";
        
        let costEst = 0.0;
        if (selectedModel.includes("reasoner")) {
          // DeepSeek-R1 pricing: $0.55/M input, $2.19/M output
          costEst = (promptTokens * 0.55 + completionTokens * 2.19) / 1000000.0;
        } else {
          // DeepSeek-V3/Flash pricing: $0.14/M input, $0.28/M output
          costEst = (promptTokens * 0.14 + completionTokens * 0.28) / 1000000.0;
        }

        const supabaseClient = createServiceClient();
        await supabaseClient.from("vanguard_llm_usage").insert({
          user_id: params.userId || null,
          model: selectedModel,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          cost_est: costEst,
          feature: params.feature || null,
        });
      }
    } catch (err) {
      console.error("[deepseekChat] Failed to log token usage:", err);
    }

    return { content, reasoning_content, tool_calls, raw };
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
