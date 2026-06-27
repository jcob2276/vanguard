import { createTelegramContext } from "./_router/config.ts";
import { handleCallbackQuery } from "./_router/callbacks.ts";
import { handleIncomingMessage } from "./_router/messages.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { corsHeaders, resolveUserScope } from "../_shared/supabase.ts";

function verifyTelegramSecret(req: Request): boolean | "missing_config" {
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (!expected) return "missing_config";
  const header = req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  return header === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody?.trim()) {
      return new Response("OK", { status: 200 });
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("[telegram] invalid JSON body");
      return new Response("OK", { status: 200 });
    }

    const ctx = createTelegramContext();

    if (payload.type === "save_link" && payload.url) {
      const { userId } = await resolveUserScope(req, ctx.vanguardUserId);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing user scope" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { handleSavedLinkDirect } = await import("./_handlers/savedLinks.ts");
      const result = await handleSavedLinkDirect(String(payload.url), userId, ctx);
      return new Response(JSON.stringify({ ok: true, link: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.setup_commands) {
      const setupSecret = Deno.env.get("TELEGRAM_SETUP_SECRET") || Deno.env.get("SB_SECRET_KEY") || "";
      const auth = req.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!setupSecret || token !== setupSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
            { command: "koniec", description: "Zakończ dzień (wieczorna refleksja)" },
            { command: "s", description: "Zaloguj suplement (np. /s)" }
          ]
        })
      });
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: res.ok, result: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.fix_webhook) {
      const setupSecret = Deno.env.get("TELEGRAM_SETUP_SECRET") || Deno.env.get("SB_SECRET_KEY") || "";
      const auth = req.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!setupSecret || token !== setupSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!ctx.telegramToken) {
        return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
      if (!webhookSecret) {
        return new Response(JSON.stringify({ error: "TELEGRAM_WEBHOOK_SECRET not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const webhookUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/vanguard-telegram`;

      const beforeRes = await fetch(`https://api.telegram.org/bot${ctx.telegramToken}/getWebhookInfo`);
      const before = await beforeRes.json().catch(() => ({}));

      const setRes = await fetch(`https://api.telegram.org/bot${ctx.telegramToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        }),
      });
      const setData = await setRes.json().catch(() => ({}));

      const afterRes = await fetch(`https://api.telegram.org/bot${ctx.telegramToken}/getWebhookInfo`);
      const after = await afterRes.json().catch(() => ({}));

      return new Response(JSON.stringify({
        ok: setRes.ok && setData.ok === true,
        webhook_url: webhookUrl,
        secret_configured: true,
        before: before.result ?? before,
        set: setData,
        after: after.result ?? after,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretCheck = verifyTelegramSecret(req);
    if (secretCheck === "missing_config") {
      console.error("[telegram] TELEGRAM_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 503 });
    }
    if (secretCheck === false) {
      console.warn("[telegram] webhook secret mismatch");
      return new Response("Forbidden", { status: 403 });
    }

    if (payload.callback_query) {
      await handleCallbackQuery(payload.callback_query as never, ctx).catch((err) => {
        console.error("[telegram] callback error:", err);
      });
      return new Response("OK", { status: 200 });
    }

    if (payload.edited_message) return new Response("OK", { status: 200 });

    const message = payload.message as {
      chat?: { id: number };
      text?: string;
      voice?: { file_id: string; duration?: number };
      audio?: { file_id: string; duration?: number; mime_type?: string };
      photo?: any[];
      message_id: number;
    } | undefined;
    if (!message) return new Response("OK", { status: 200 });
    if (!message.text && !message.voice && !message.audio && !message.photo) {
      console.log("[telegram] ignored message: no text/voice/audio/photo");
      return new Response("OK", { status: 200 });
    }
    if (!Number.isFinite(ctx.authorizedChatId) || ctx.authorizedChatId <= 0 || message.chat?.id !== ctx.authorizedChatId) {
      return new Response("OK", { status: 200 });
    }

    await handleIncomingMessage(message as never, ctx);
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
