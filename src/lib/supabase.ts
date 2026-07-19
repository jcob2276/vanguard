import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import type { EdgeFunctionResponses } from './edgeTypes';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

/**
 * Invoke a Supabase Edge Function with type-safe responses.
 *
 * Register the function name in `EdgeFunctionResponses` (src/lib/edgeTypes.ts)
 * to get compile-time response checking. Unregistered names return
 * `Record<string, unknown>` — add the name to the registry instead of using `<any>`.
 */
type EdgeBody = string | Record<string, unknown> | File | Blob | ArrayBuffer | FormData | ReadableStream<Uint8Array> | undefined;

export async function invokeEdge<K extends keyof EdgeFunctionResponses>(
  functionName: K,
  options?: {
    body?: EdgeBody;
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    signal?: AbortSignal;
    query?: Record<string, string>;
  }
): Promise<EdgeFunctionResponses[K]>;
export async function invokeEdge(
  functionName: string,
  options?: {
    body?: EdgeBody;
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    signal?: AbortSignal;
    query?: Record<string, string>;
  }
): Promise<Record<string, unknown>>;
export async function invokeEdge(
  functionName: string,
  options?: {
    body?: EdgeBody;
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    signal?: AbortSignal;
    query?: Record<string, string>;
  }
): Promise<Record<string, unknown>> {
  const queryString = options?.query ? new URLSearchParams(options.query).toString() : '';
  const targetName = queryString ? `${functionName}?${queryString}` : functionName;
  const { data, error } = await supabase.functions.invoke(targetName, {
    body: options?.body,
    method: options?.method || 'POST',
    headers: options?.headers,
    signal: options?.signal,
  });

  if (error) {
    throw new Error(error.message || `Edge function ${functionName} failed`);
  }
  return data as Record<string, unknown>;
}
