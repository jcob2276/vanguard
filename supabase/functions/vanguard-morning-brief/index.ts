/**
 * Deprecated 2026-06-12.
 *
 * Morning Telegram brief/rescue was removed after it produced repeated
 * "weak plan" nudges. Vanguard no longer sends autonomous morning plan
 * correction messages.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    error: "vanguard-morning-brief deprecated",
    deprecated: true,
    reason: "autonomous morning Telegram nudges removed",
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
