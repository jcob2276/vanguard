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

export async function resolveUserScope(
  req: Request,
  requestedUserId: string | null = null,
): Promise<{ userId: string | null; isServiceRole: boolean }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) throw new Error("Missing Authorization bearer token");

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceRoleKey && token === serviceRoleKey) {
    return { userId: requestedUserId, isServiceRole: true };
  }

  const { data, error } = await createServiceClient().auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid user token");

  if (requestedUserId && requestedUserId !== data.user.id) {
    throw new Error("Forbidden userId mismatch");
  }

  return { userId: data.user.id, isServiceRole: false };
}

/**
 * Wraps a Supabase query promise.
 * Logs the error to console.error and throws an exception if the query fails,
 * preventing silent failures.
 */
export async function safeExecute(promise: any): Promise<any> {
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
