import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { createTelegramContext } from "../vanguard-telegram/_router/config.ts";
import { handleCallbackQuery } from "../vanguard-telegram/_router/callbacks.ts";
import { handleIncomingMessage } from "../vanguard-telegram/_router/messages.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let recordId: string | null = null;
  try {
    const supabase = createServiceClient();
    const payload = await req.json();
    const { record } = payload;

    if (!record || !record.id || !record.payload) {
      return new Response(JSON.stringify({ error: "Invalid payload structure" }), { status: 400 });
    }

    recordId = record.id;

    // 1. Mark status as 'processing'
    const { error: startError } = await supabase
      .from("vanguard_telegram_inbox")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", recordId);

    if (startError) {
      console.error(`[telegram-worker] failed to set processing status for ${recordId}:`, startError);
      return new Response(JSON.stringify({ error: startError.message }), { status: 500 });
    }

    console.log(`[telegram-worker] started processing inbox id: ${recordId}`);

    const innerPayload = record.payload;
    const ctx = createTelegramContext();

    if (innerPayload.callback_query) {
      await handleCallbackQuery(innerPayload.callback_query as never, ctx);
    } else {
      const message = innerPayload.message;
      if (message) {
        await handleIncomingMessage(message as never, ctx);
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

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (err) {
    console.error("[telegram-worker] processing failed:", err);
    
    // Attempt to save error stack to DB
    if (recordId) {
      try {
        const supabase = createServiceClient();
        const trace = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
        await supabase
          .from("vanguard_telegram_inbox")
          .update({ status: "failed", error_log: trace, updated_at: new Date().toISOString() })
          .eq("id", recordId);
      } catch (dbErr: unknown) {
    console.error('[Edge Function Error]', dbErr);
    return new Response(JSON.stringify({ error: dbErr instanceof Error ? dbErr.message : String(dbErr) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
    }

    await logCriticalError({
      area: "telegram-worker",
      error: err,
      message: `Telegram worker processing error for record: ${recordId}`,
    });

    return new Response("Error processed", { status: 200 });
  }
});
