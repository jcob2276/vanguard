/**
 * Deprecated 2026-06-12.
 *
 * Friction QA Telegram reports were removed. The classifier can still be
 * inspected directly in SQL when needed; this endpoint no longer produces
 * reports or sends messages.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    error: "vanguard-friction-qa deprecated",
    deprecated: true,
    reason: "autonomous friction QA Telegram reports removed",
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
