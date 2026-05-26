import { corsHeaders } from "../_shared/supabase.ts";
/**
 * vanguard-reset-prompt — DEPRECATED (2026-05-23)
 *
 * Periodic attention-reset cron was removed. Do not re-enable without
 * PRODUCT_PRINCIPLES review. Replacement: morning-brief + anchors in stream.
 *
 * Registry: supabase/functions/README.md (status: deprecated)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  console.warn(
    "[reset-prompt] DEPRECATED — invoked but cron should be off since 2026-05-23",
  )

  return new Response(
    JSON.stringify({
      deprecated: true,
      status: "gone",
      message:
        "vanguard-reset-prompt is deprecated. Cron removed 2026-05-23. Use vanguard-morning-brief and stream anchors.",
      replacement: ["vanguard-morning-brief", "anchor: entries in vanguard_stream"],
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
