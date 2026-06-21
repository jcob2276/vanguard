/**
 * vanguard-telegram — webhook entry (thin router).
 * Callbacks → _router/callbacks.ts | Messages → _router/messages.ts
 * Domain logic → _handlers/*
 */

import { createTelegramContext } from "./_router/config.ts";
import { handleCallbackQuery } from "./_router/callbacks.ts";
import { handleIncomingMessage } from "./_router/messages.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { corsHeaders } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  // Support OPTIONS for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const ctx = createTelegramContext();

    // Manual link save from the web app (Pocket "+" button)
    if (payload.type === "save_link" && payload.url) {
      const { handleSavedLinkDirect } = await import("./_handlers/savedLinks.ts");
      const result = await handleSavedLinkDirect(payload.url, ctx.vanguardUserId, ctx);
      return new Response(JSON.stringify({ ok: true, link: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Telegram setMyCommands configuration trigger
    if (payload.setup_commands) {
      const res = await fetch(`https://api.telegram.org/bot${ctx.telegramToken}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "start", description: "Pokaż menu główne i klawiaturę" },
            { command: "posilek", description: "Zaloguj posiłek (np. /posilek 2 jajka)" },
            { command: "todo", description: "Dodaj zadanie (np. /todo Zrób pranie +jutro)" },
            { command: "keep", description: "Zapisz notatkę (np. /keep Zakupy)" },
            { command: "lenie", description: "Zapisz lenie (np. /lenie scrollowanie | zmęczenie)" },
            { command: "dieta", description: "Pokaż podsumowanie diety" },
            { command: "pytanie", description: "Uruchom wywiad" },
            { command: "koniec", description: "Zakończ dzień (wieczorna refleksja)" }
          ]
        })
      });
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: res.ok, result: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.callback_query) {
      await handleCallbackQuery(payload.callback_query, ctx).catch((err) => {
        console.error("[telegram] callback error:", err);
      });
      return new Response("OK", { status: 200 });
    }

    // Edits aren't new events — handling them like new messages double-logs the same
    // note in vanguard_stream (original + edited version), corrupting behavioral analysis.
    if (payload.edited_message) return new Response("OK", { status: 200 });

    const message = payload.message;
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
