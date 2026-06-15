/**
 * vanguard-telegram — webhook entry (thin router).
 * Callbacks → _router/callbacks.ts | Messages → _router/messages.ts
 * Domain logic → _handlers/*
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createTelegramContext } from "./_router/config.ts";
import { handleCallbackQuery } from "./_router/callbacks.ts";
import { handleIncomingMessage } from "./_router/messages.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { corsHeaders } from "../_shared/supabase.ts";

serve(async (req) => {
  // Support OPTIONS for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const ctx = createTelegramContext();

    // Support direct HTTP calls from the web app for PWA Share Target
    if (payload.type === "share_target" && payload.url) {
      const { handleSavedLinkDirect } = await import("./_handlers/savedLinks.ts");
      try {
        const result = await handleSavedLinkDirect(payload.url, payload.userId, ctx);
        return new Response(JSON.stringify({ success: true, link: result }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        console.error("[telegram] Share target processing error:", err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (payload.callback_query) {
      await handleCallbackQuery(payload.callback_query, ctx).catch((err) => {
        console.error("[telegram] callback error:", err);
      });
      return new Response("OK", { status: 200 });
    }

    const message = payload.message || payload.edited_message;
    if (!message) return new Response("OK", { status: 200 });
    if (!message.text && !message.voice) return new Response("OK", { status: 200 });
    if (message.chat.id !== ctx.authorizedChatId) {
      return new Response("OK", { status: 200 });
    }

    await handleIncomingMessage(message, ctx);
    return new Response("OK", { status: 200 });
  } catch (err) {
    await logCriticalError({
      area: 'telegram-webhook',
      error: err,
      message: 'Top-level Telegram webhook error',
    });
    return new Response("OK", { status: 200 });
  }
});
