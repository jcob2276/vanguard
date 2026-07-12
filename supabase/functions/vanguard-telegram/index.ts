/**
 * @function vanguard-telegram
 * @trigger HTTP POST / Telegram Webhook (wejście)
 * @role WEJŚCIE: Webhook od Telegrama, autoryzuje chat, odbiera wiadomości i wrzuca do vanguard_telegram_inbox.
 * @reads ai_chat_messages, audit_events, claims, daily_food_entries, daily_reconciliations, entities, fasting_logs, food_corrections, food_library, food_parse_pending, habit_logs, oracle_clarification_requests, supplement_logs, supplements, todo_items, user_fundament, vanguard_entity_links, vanguard_feedback, vanguard_links, vanguard_notes, vanguard_preferences, vanguard_stream, vanguard_stream_closure_proposals, vanguard_telegram_inbox
 * @writes ai_chat_messages, audit_events, daily_food_entries, daily_reconciliations, fasting_logs, food_corrections, food_library, food_parse_pending, habit_logs, oracle_clarification_requests, supplement_logs, todo_items, user_fundament, vanguard_entity_links, vanguard_feedback, vanguard_links, vanguard_notes, vanguard_preferences, vanguard_stream, vanguard_stream_closure_proposals, vanguard_telegram_inbox
 * @calls api.telegram.org (poprzez setMyCommands/setWebhook)
 * @consumer Kolejka wejściowa Telegrama (inbox)
 * @status active
 */
import { createTelegramContext } from "./_router/config.ts";
import { handleCallbackQuery } from "./_router/callbacks.ts";
import { handleIncomingMessage } from "./_router/messages.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { resolveUserScope } from "../_shared/supabase.ts";
import { serveJson } from "../_shared/http.ts";

function verifyTelegramSecret(req: Request): boolean | "missing_config" {
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (!expected) return "missing_config";
  const header = req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  return header === expected;
}

Deno.serve(serveJson(async (req, jsonCtx) => {
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

  // save_link / setup_commands / fix_webhook are manual/admin-only utility branches —
  // never invoked by Telegram itself (no `update_id`/`message` shape), so they're free
  // to use serveJson's normal JSON error/success framing (real errors surface as real
  // non-2xx responses) instead of the webhook's plain-text-always-200 contract below,
  // which exists specifically to stop Telegram's own retry storm on internal failures.
  if (payload.type === "save_link" && payload.url) {
      const { userId } = await resolveUserScope(req, ctx.vanguardUserId);
      if (!userId) throw new Error("Missing user scope");
      const { handleSavedLinkDirect } = await import("./_handlers/savedLinks.ts");
      const result = await handleSavedLinkDirect(String(payload.url), userId, ctx);
      return { ok: true, link: result };
    }

    if (payload.setup_commands) {
      const setupSecret = Deno.env.get("TELEGRAM_SETUP_SECRET") || Deno.env.get("SB_SECRET_KEY") || "";
      const auth = req.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!setupSecret || token !== setupSecret) throw new Error("Unauthorized");
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
      return { ok: res.ok, result: data };
    }

    if (payload.fix_webhook) {
      const setupSecret = Deno.env.get("TELEGRAM_SETUP_SECRET") || Deno.env.get("SB_SECRET_KEY") || "";
      const auth = req.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!setupSecret || token !== setupSecret) throw new Error("Unauthorized");
      if (!ctx.telegramToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

      const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
      if (!webhookSecret) throw new Error("TELEGRAM_WEBHOOK_SECRET not configured");

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

      return {
        ok: setRes.ok && setData.ok === true,
        webhook_url: webhookUrl,
        secret_configured: true,
        before: before.result ?? before,
        set: setData,
        after: after.result ?? after,
      };
    }

    // From here on: genuine Telegram webhook processing. Always ack "OK" 200, swallowing
    // internal errors, so Telegram doesn't retry-storm this endpoint on our failures.
    try {
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
        const supabase = jsonCtx.supabase;
        const { error } = await supabase
          .from("vanguard_telegram_inbox")
          .insert({ payload });
        if (error) {
          console.error("[telegram] failed to queue callback_query:", error);
        }
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

      const supabase = jsonCtx.supabase;
      const { error } = await supabase
        .from("vanguard_telegram_inbox")
        .insert({ payload });
      if (error) {
        console.error("[telegram] failed to queue message:", error);
      }
      return new Response("OK", { status: 200 });
    } catch (err) {
      await logCriticalError({
        area: 'telegram-webhook',
        error: err,
        message: 'Top-level Telegram webhook error',
      });
      return new Response("OK", { status: 200 });
    }
}, { auth: 'none' }));
