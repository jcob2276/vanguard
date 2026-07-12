/**
 * httpClient.ts — Shared outbound HTTP primitive for edge functions.
 *
 * Wraps `fetch` with a timeout (AbortController) and optional retry with exponential
 * backoff on transient failures (network errors, 429/502/503/504). Every external
 * integration (DeepSeek, OpenAI, Telegram) previously reimplemented timeout handling
 * independently with no retry — this is the single place that logic lives now.
 *
 * Does NOT throw on non-2xx responses (callers keep checking `res.ok` as before) —
 * it only retries/throws on retryable-status or network-level failures.
 */

export interface FetchWithRetryOptions {
  timeoutMs?: number;
  /** Number of retry attempts after the first try. Default 0 (no retry). */
  retries?: number;
  retryDelayMs?: number;
  retryStatusCodes?: number[];
  /** Prefix used in retry/failure log lines, e.g. "deepseek", "telegram.sendMessage". */
  logTag?: string;
}

const DEFAULT_RETRY_STATUS_CODES = [429, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: FetchWithRetryOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const retries = opts.retries ?? 0;
  const retryDelayMs = opts.retryDelayMs ?? 300;
  const retryStatusCodes = opts.retryStatusCodes ?? DEFAULT_RETRY_STATUS_CODES;
  const logTag = opts.logTag ?? 'httpClient';

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);

      if (retryStatusCodes.includes(res.status) && attempt < retries) {
        console.warn(`[${logTag}] retryable status ${res.status} on attempt ${attempt + 1}/${retries + 1}, retrying...`);
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < retries) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[${logTag}] fetch failed on attempt ${attempt + 1}/${retries + 1}: ${msg}, retrying...`);
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`[${logTag}] fetch failed after ${retries + 1} attempts`);
}
