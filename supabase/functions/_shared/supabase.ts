import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key);
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

/**
 * Wraps a Supabase query promise.
 * Logs the error to console.error and throws an exception if the query fails,
 * preventing silent failures.
 */
export async function safeExecute<T>(
  promise: Promise<{ data: T; error: any }>
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    console.error("[Supabase Error]:", error);
    throw new Error(`Database operation failed: ${error.message || JSON.stringify(error)}`);
  }
  return data;
}
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
