/**
 * @function vanguard-telegram-worker
 * @trigger DB trigger na wstawienie nowego rekordu w vanguard_telegram_inbox (async)
 * @role Asynchroniczny procesor Telegrama: przetwarza wiadomości i callbacki z kolejki inbox.
 * @reads vanguard_telegram_inbox, vanguard_stream, daily_reconciliations
 * @writes vanguard_telegram_inbox (status, error_log)
 * @calls api.telegram.org (poprzez send.ts), deepseek-v4-flash, openai (Whisper)
 * @consumer Wynik działania procesora (odpowiedź do użytkownika na Telegramie)
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import { createTelegramContext } from "../vanguard-telegram/_router/config.ts";
import { handleCallbackQuery } from "../vanguard-telegram/_router/callbacks.ts";
import { handleIncomingMessage } from "../vanguard-telegram/_router/messages.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";

// Same "always 200" design as vanguard-outbox-sender — the async DB trigger must not see
// a non-2xx or it retries indefinitely. Errors are caught, logged, and swallowed here.
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

    // 1. Mark status as 'processing'
    const { error: startError } = await supabase
      .from("vanguard_telegram_inbox")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", recordId);

    if (startError) {
      console.error(`[telegram-worker] failed to set processing status for ${recordId}:`, startError);
      return { error: startError.message };
    }

    console.log(`[telegram-worker] started processing inbox id: ${recordId}`);

    const innerPayload = record.payload;
    const telegramCtx = createTelegramContext();

    if (innerPayload.callback_query) {
      await handleCallbackQuery(innerPayload.callback_query as never, telegramCtx);
    } else {
      const message = innerPayload.message;
      if (message) {
        await handleIncomingMessage(message as never, telegramCtx);
      }
    }

    // 2. Mark status as 'completed'
    const { error: endError } = await supabase
      .from("vanguard_telegram_inbox")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", recordId);

    if (endError) {
      console.error(`[telegram-worker] failed to set completed status for ${recordId}:`, endError);
    }

    return { ok: true };

  } catch (err) {
    console.error("[telegram-worker] processing failed:", err);

    // Attempt to save error stack to DB
    if (recordId) {
      try {
        const trace = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
        await supabase
          .from("vanguard_telegram_inbox")
          .update({ status: "failed", error_log: trace, updated_at: new Date().toISOString() })
          .eq("id", recordId);
      } catch (dbErr: unknown) {
        console.error('[telegram-worker] db update failure:', dbErr);
      }
    }

    await logCriticalError({
      area: "telegram-worker",
      error: err,
      message: `Telegram worker processing error for record: ${recordId}`,
    });

    return "Error processed";
  }
}, { auth: 'service' }));
