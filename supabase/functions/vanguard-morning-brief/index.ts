/**
 * vanguard-morning-brief
 *
 * Cron: 05:00 UTC daily = 07:00 Warsaw (CEST) / 06:00 (CET)
 * Sends a short action-oriented start message (not a document).
 * Full plan sent only when user clicks "Pokaż plan".
 * Tracks morning_sent_at to prevent duplicate sends and enable ping detection.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendMessage } from "../_shared/telegram.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || '';
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createServiceClient();

serve(async () => {
  try {
    if (!TELEGRAM_CHAT_ID) {
      console.warn('[morning-brief] TELEGRAM_CHAT_ID not set, skipping');
      return new Response('ok');
    }

    const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });

    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('id, planning_summary, answered_at, morning_sent_at')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[morning-brief] DB error:', error.message);
      return new Response('error', { status: 500 });
    }

    const row = rows?.find(r =>
      r.planning_summary?.target_date === todayWarsawDate &&
      !r.planning_summary?.parse_error
    );

    if (!row) {
      console.log(`[morning-brief] No plan for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    if (row.morning_sent_at) {
      console.log(`[morning-brief] Already sent for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    const plan = row.planning_summary as Record<string, any>;
    const firstMove = plan.first_move_morning || plan.pierwszy_ruch || '—';
    // one_clear_move: new schema field, falls back to top3[0]
    const oneClearMove = plan.one_clear_move || (plan.top3 as string[] || [])[0] || '—';
    const ta = plan.tension_action as { action?: string; status?: string } | undefined;
    const taActive = ta?.action && ta?.status !== 'done';

    const text =
      `Start dnia.\n\nNie scrolluj.\n\n` +
      `Pierwszy ruch:\n→ Woda.\n→ Otwórz: ${firstMove}.\n→ 10 minut.\n\n` +
      `Dzisiaj dzień wygrywa:\n${oneClearMove}` +
      (taActive ? `\n\n⚡ Ruch napięciowy:\n${ta!.action}` : '');

    const res = await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
      replyMarkup: {
        inline_keyboard: [[
          { text: '✅ Start 10 min', callback_data: 'morning_start' },
          { text: '📋 Pokaż plan', callback_data: 'morning_show_plan' },
          { text: '😵 Wstałem za późno', callback_data: 'morning_late' }
        ]]
      },
      disableNotification: false,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'unknown');
      console.error('[morning-brief] sendMessage failed:', res.status, errBody.substring(0, 100));
      return new Response('error', { status: 500 });
    }

    await supabase
      .from('daily_reconciliations')
      .update({ morning_sent_at: new Date().toISOString() })
      .eq('id', row.id);

    console.log(`[morning-brief] Start message sent for ${todayWarsawDate}, row ${row.id}.`);
    return new Response('ok');
  } catch (err) {
    console.error('[morning-brief] error:', err);
    return new Response('error', { status: 500 });
  }
});
