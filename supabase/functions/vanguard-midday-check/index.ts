/**
 * Deprecated 2026-06-12.
 *
 * The useful 12:00 Telegram flow is vanguard-eval-interview ("Wywiad"),
 * not this legacy task/artifact check. Keep this endpoint as a no-op stub.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    error: "vanguard-midday-check deprecated",
    deprecated: true,
    reason: "legacy task/artifact check removed; noon interview remains in vanguard-eval-interview",
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
