/**
 * vanguard-morning-ping
 *
 * Cron: 05:20 UTC = 07:20 Warsaw CEST (20 min after morning brief)
 * Fires if morning brief was sent but user hasn't clicked any button.
 * Brak kliknięcia = sygnał driftu.
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
    if (!TELEGRAM_CHAT_ID) return new Response('ok');

    const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });

    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('id, planning_summary, morning_sent_at, morning_clicked_at')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[morning-ping] DB error:', error.message);
      return new Response('error', { status: 500 });
    }

    const row = rows?.find((r: any) =>
      r.planning_summary?.target_date === todayWarsawDate &&
      !r.planning_summary?.parse_error &&
      r.morning_sent_at &&        // brief was sent
      !r.morning_clicked_at       // but no interaction yet
    );

    if (!row) {
      console.log(`[morning-ping] No unresponded brief for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    const plan = row.planning_summary as Record<string, any>;
    const mvd = plan.minimum_viable_day || plan.first_move_morning || plan.pierwszy_ruch || '—';

    const text =
      `Brak sygnału po first move.\n\n` +
      `Zakładam drift albo opór.\n\n` +
      `Minimum teraz:\n${mvd}`;

    const res = await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
      replyMarkup: {
        inline_keyboard: [[
          { text: '▶️ Start', callback_data: 'morning_start' },
          { text: '🔧 Utknąłem', callback_data: 'morning_stuck' },
          { text: '📋 Pokaż plan', callback_data: 'morning_show_plan' }
        ]]
      },
      disableNotification: false,
    });

    if (!res.ok) {
      console.error('[morning-ping] sendMessage failed:', res.status);
      return new Response('error', { status: 500 });
    }

    console.log(`[morning-ping] Drift ping sent for ${todayWarsawDate}, row ${row.id}.`);
    return new Response('ok');
  } catch (err) {
    console.error('[morning-ping] error:', err);
    return new Response('error', { status: 500 });
  }
});
