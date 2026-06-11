/**
 * Deprecated.
 *
 * This used to generate a plan-vs-Strava LLM report and push it to Telegram.
 * The Telegram surface was intentionally removed on 2026-06-11.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/supabase.ts";

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "analyze-training is deprecated",
      message: "Training plan-vs-Strava Telegram analysis has been removed.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
