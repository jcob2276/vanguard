/**
 * @function vanguard-outbox-sender
 * @trigger DB trigger na wstawienie nowego rekordu w outbound_messages (async via pg_net)
 * @role Asynchroniczny nadawca wiadomości z kolejki outbox: odbiera żądania, wysyła do Telegram API i aktualizuje status.
 * @reads outbound_messages
 * @writes outbound_messages (status, error_log, attempts)
 * @calls api.telegram.org
 * @status active
 */
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { requireServiceRole } from "../_shared/auth.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { callTelegramMethod } from "../_shared/telegram.ts";
// Force upload of domain package for shared dependencies
import type {} from "@vanguard/domain";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authError = requireServiceRole(req);
  if (authError) return authError;

  let recordId: string | null = null;
  try {
    const supabase = createServiceClient();
    const payload = await req.json();
    const { record } = payload;

    if (!record || !record.id || !record.payload) {
      return new Response(JSON.stringify({ error: "Invalid payload structure" }), { status: 400 });
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
      return new Response(JSON.stringify({ error: startError.message }), { status: 500 });
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

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (err) {
    console.error("[outbox-sender] processing failed:", err);
    
    if (recordId) {
      try {
        const supabase = createServiceClient();
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

    return new Response("Error processed", { status: 200 });
  }
});
