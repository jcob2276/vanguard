import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key);
}

export async function resolveUserScope(
  req: Request,
  requestedUserId: string | null = null,
): Promise<{ userId: string | null; isServiceRole: boolean }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) throw new Error("Missing Authorization bearer token");

  const secretKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (secretKey && token === secretKey) {
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
/** CORS headers — whitelist via ALLOWED_ORIGINS (comma-separated). Falls back to * when unset. */
export function corsHeadersFor(req?: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const requestOrigin = req?.headers.get('Origin') ?? '';
  let origin = '*';
  if (allowed.length > 0) {
    origin = allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    ...(allowed.length > 0 ? { Vary: 'Origin' } : {}),
  };
}

/** Static fallback for handlers that don't have the request object. */
export const corsHeaders = corsHeadersFor();
