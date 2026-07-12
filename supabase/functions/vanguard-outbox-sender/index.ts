/**
 * @function vanguard-outbox-sender
 * @trigger DB trigger na wstawienie nowego rekordu w outbound_messages (async via pg_net)
 * @role Asynchroniczny nadawca wiadomości z kolejki outbox: odbiera żądania, wysyła do Telegram API i aktualizuje status.
 * @reads outbound_messages
 * @writes outbound_messages (status, error_log, attempts)
 * @calls api.telegram.org
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { callTelegramMethod } from "../_shared/telegram.ts";
// Force upload of domain package for shared dependencies
import type {} from "@vanguard/domain";

// This handler deliberately never throws to serveJson's top-level catch (which would
// return 401/500) — it always resolves 200 so the pg_net outbox trigger doesn't retry
// indefinitely on a domain-level failure. Errors are caught, logged to both
// outbound_messages and audit_events, and swallowed here instead.
Deno.serve(serveJson(async (req, ctx) => {
  const supabase = ctx.supabase;
  let recordId: string | null = null;
  try {
    const payload = await req.clone().json();
    const { record } = payload;

    if (!record || !record.id || !record.payload) {
      return { error: "Invalid payload structure" };
    }

    recordId = record.id;
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    // 1. Mark status as 'processing'
    const { error: startError } = await supabase
      .from("outbound_messages")
      .update({ status: "processing", attempts: (record.attempts || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", recordId);

    if (startError) {
      console.error(`[outbox-sender] failed to set processing status for ${recordId}:`, startError);
      return { error: startError.message };
    }

    console.log(`[outbox-sender] sending outbox item: ${recordId}, method: ${record.payload.method}`);

    // 2. Call Telegram Bot API
    const method = record.payload.method || "sendMessage";
    const body = record.payload.body || {};

    const responseData = await callTelegramMethod(token, method, body);

    if (!responseData.ok) {
      throw new Error(`Telegram API failed: ${responseData.description || "unknown error"}`);
    }

    // 3. Mark status as 'sent'
    const { error: endError } = await supabase
      .from("outbound_messages")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", recordId);

    if (endError) {
      console.error(`[outbox-sender] failed to set sent status for ${recordId}:`, endError);
    }

    return { ok: true };

  } catch (err) {
    console.error("[outbox-sender] processing failed:", err);

    if (recordId) {
      try {
        const trace = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
        await supabase
          .from("outbound_messages")
          .update({
            status: "failed",
            error_log: trace,
            updated_at: new Date().toISOString()
          })
          .eq("id", recordId);
      } catch (dbErr: unknown) {
        console.error('[outbox-sender] db update failure:', dbErr);
      }
    }

    await logCriticalError({
      area: "outbox-sender",
      error: err,
      message: `Telegram outbox sender error for record: ${recordId}`,
    });

    return "Error processed";
  }
}, { auth: 'service' }));
