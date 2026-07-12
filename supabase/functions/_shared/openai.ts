import { createServiceClient } from "./supabase.ts";
import { fetchWithRetry } from "./httpClient.ts";

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
  userId?: string;
  feature?: string;
}

export interface OpenAIChatResult {
  content: string;
  raw: unknown;
}

/** Centralized OpenAI chat-completions call (text or vision) — mirrors deepseekChat's shape. */
export async function openaiChat(params: OpenAIChatParams): Promise<OpenAIChatResult> {
  const timeoutMs = params.timeoutMs ?? 45000;

  const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
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
  }, { timeoutMs, retries: 1, logTag: "openai.chat" });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const raw = await res.json();
  const content: string = (raw as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices?.[0]?.message?.content || "";

  try {
    const usage = (raw as { usage?: Record<string, unknown> })?.usage;
    if (usage) {
      const promptTokens = Number(usage.prompt_tokens ?? 0);
      const completionTokens = Number(usage.completion_tokens ?? 0);
      const totalTokens = Number(usage.total_tokens ?? 0);
      const selectedModel = params.model ?? "gpt-4o-mini";

      let costEst = 0.0;
      if (selectedModel.includes("gpt-4o-mini")) {
        costEst = (promptTokens * 0.15 + completionTokens * 0.60) / 1000000.0;
      } else if (selectedModel.includes("gpt-4o")) {
        costEst = (promptTokens * 2.50 + completionTokens * 10.00) / 1000000.0;
      } else {
        costEst = (promptTokens * 0.15 + completionTokens * 0.60) / 1000000.0;
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
    console.error("[openaiChat] Failed to log token usage:", err);
  }

  return { content, raw };
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
  const formData = new FormData();
  formData.append("file", audioBlob, opts?.filename ?? "audio.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", opts?.language ?? "pl");

  const res = await fetchWithRetry("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  }, { timeoutMs: opts?.timeoutMs ?? 30000, retries: 1, logTag: "openai.transcribe" });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`Whisper HTTP error (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Whisper Error: ${data.error.message}`);
  return data.text || "";
}

export async function getEmbedding(text: string | string[], apiKey: string): Promise<number[] | number[][] | null> {
  if (!apiKey) {
    console.error("[OpenAI] Missing API key for embedding generation.");
    return null;
  }
  try {
    const res = await fetchWithRetry("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: Array.isArray(text) ? text : text.replace(/\n/g, " ").slice(0, 8000),
      }),
    }, { timeoutMs: 15000, retries: 1, logTag: "openai.embedding" });
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
