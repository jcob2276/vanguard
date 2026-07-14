import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeEdge<T = any>(
  functionName: string,
  options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: options?.body,
    method: options?.method || 'POST',
    headers: options?.headers,
    signal: options?.signal,
  });

  if (error) {
    throw new Error(error.message || `Edge function ${functionName} failed`);
  }
  return data as T;
}

export async function invokeEdgeStream(
  functionName: string,
  options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const base = supabaseUrl || 'https://placeholder.supabase.co';
  const url = `${base}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: options?.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Edge function stream ${functionName} failed: ${response.status} ${errText}`);
  }

  return response;
}
