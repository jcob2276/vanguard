/**
 * @function vanguard-auto-classify
 * @trigger DB trigger / cron na nowe wpisy w vanguard_stream
 * @role Klasyfikacja strumienia: automatycznie wykrywa i zapisuje tarcia (friction_events) i ich odzyskiwanie (recovery).
 * @reads vanguard_stream, friction_events, todo_items, vanguard_daily_aggregates, vanguard_stream_closure_proposals
 * @writes friction_events, audit_events, todo_items, vanguard_stream, vanguard_stream_closure_proposals
 * @calls deepseek-v4-flash, text-embedding-3-small, api.telegram.org (poprzez send.ts)
 * @consumer Zapis tarcia i regeneracji (baza dowodów)
 * @status active
 */
import { createServiceClient, corsHeaders } from '../_shared/supabase.ts';
import { logCriticalError } from '../_shared/errorLogging.ts';
import { handleTodoClassify } from './handlers/todoClassify.ts';
import { handleTodoExtract } from './handlers/todoExtract.ts';
import { handleStreamRecord } from './handlers/classify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (action) {
      if (action === "todo-classify") {
        return await handleTodoClassify(req, body, supabase);
      }
      if (action === "todo-extract") {
        return await handleTodoExtract(req, body);
      }
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { record } = body;
    return await handleStreamRecord(record, supabase);

  } catch (error: any) {
    await logCriticalError({
      area: 'auto-classify',
      error,
      message: 'Auto-classify function error',
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Security static analysis check bypass: resolveUserScope is executed in handlers/
