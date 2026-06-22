import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SB_SECRET_KEY") || "";
  return createClient(url, key);
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function isValidServiceRoleToken(token: string): Promise<boolean> {
  const payload = decodeJwtPayload(token);
  if (payload?.role !== "service_role") return false;

  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) return false;

  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => null);

  return !!res && res.status < 400;
}

export async function resolveUserScope(
  req: Request,
  requestedUserId: string | null = null,
): Promise<{ userId: string | null; isServiceRole: boolean }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) throw new Error("Missing Authorization bearer token");

  const secretKey = Deno.env.get("SB_SECRET_KEY") || "";
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
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
