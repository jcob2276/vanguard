import { corsHeaders } from "../_shared/supabase.ts";
/**
 * vanguard-intentions-cleanup — DEPRECATED (2026-05-29)
 *
 * Ten cron autonomicznie ustawiał status='manifested'/'released' na intencjach
 * użytkownika na podstawie oceny LLM. To łamie docs/PRODUCT_PRINCIPLES.md
 * "Transurfing Layer Guardrail": system NIGDY nie orzeka, że manifestacja
 * zadziałała. Status intencji zmienia wyłącznie użytkownik (UI).
 *
 * Logika "porównaj deklarację ze strumieniem" żyje teraz w warstwie CZYTANIA:
 * Oracle dostaje blok [DEKLAROWANE INTENCJE] (streamContext.fetchDeclaredIntentions)
 * i konfrontuje deklarację z zachowaniem — bez mutacji.
 *
 * Cron usunięty migracją 20260603000001_unschedule_intentions_cleanup.sql.
 * Registry: supabase/functions/README.md (status: deprecated)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  console.warn(
    "[intentions-cleanup] DEPRECATED — invoked but cron should be off since 2026-05-29",
  )

  return new Response(
    JSON.stringify({
      deprecated: true,
      status: "gone",
      message:
        "vanguard-intentions-cleanup is deprecated. System nie orzeka o 'manifestacji' (PRODUCT_PRINCIPLES). Status intencji zmienia użytkownik; konfrontacja deklaracja-vs-zachowanie żyje w Oracle.",
      replacement: ["vanguard-oracle: blok [DEKLAROWANE INTENCJE]"],
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
