/**
 * Deprecated 2026-06-12.
 *
 * Morning ping/nudge was removed with vanguard-morning-brief. Vanguard should
 * not autonomously nag about missing clicks or weak plans in the morning.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    error: "vanguard-morning-ping deprecated",
    deprecated: true,
    reason: "autonomous morning Telegram nudges removed",
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
