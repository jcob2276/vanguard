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

serve(async (req) => {
  try {
    const payload = await req.json();
    const ctx = createTelegramContext();

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
