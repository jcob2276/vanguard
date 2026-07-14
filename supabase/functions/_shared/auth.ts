import { corsHeadersFor } from "./supabase.ts";

/**
 * Validates that the request has a valid Service Role authorization header.
 * Returns a 401 Response if unauthorized, or null if authorized.
 */
export function requireServiceRole(req: Request): Response | null {
  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const apiKey = req.headers.get("apikey") || "";
  const token = bearerToken || apiKey;
  const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!serviceRoleKey || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeadersFor(req), "Content-Type": "application/json" }
    });
  }
  return null;
}
