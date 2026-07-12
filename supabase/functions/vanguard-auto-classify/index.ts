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
import { serveJson } from '../_shared/http.ts';
import { handleTodoClassify } from './handlers/todoClassify.ts';
import { handleTodoExtract } from './handlers/todoExtract.ts';
import { handleStreamRecord } from './handlers/classify.ts';

// resolveUserScope is executed in handlers/, not here — auth:'none' below is intentional.
Deno.serve(serveJson(async (req, ctx) => {
  const supabase = ctx.supabase;
  const body = await req.clone().json().catch(() => ({}));
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || body.action;

  if (action) {
    if (action === "todo-classify") {
      return await handleTodoClassify(req, body, supabase);
    }
    if (action === "todo-extract") {
      return await handleTodoExtract(req, body);
    }
    throw new Error(`Unknown action: ${action}`);
  }

  const { record } = body;
  return await handleStreamRecord(record, supabase);
}, { auth: 'none' }));
