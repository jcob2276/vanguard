/**
 * vanguard-midday-check
 *
 * Cron: 11:00 UTC daily = 13:00 Warsaw (CEST) / 12:00 (CET)
 * Sends a short check on today's first move.
 * Uses planning_summary.first_move_morning as the anchor.
 * Silently skips if no plan for today or midday already sent.
 *
 * Response buttons handled in vanguard-telegram callback_query:
 *   midday_yes  → "Zapisane. Trzymaj Top 1."
 *   midday_no   → minimum_viable_day
 *   midday_stuck → biggest_risk + counterplan
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || '';
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async () => {
  try {
    if (!TELEGRAM_CHAT_ID) {
      console.warn('[midday-check] TELEGRAM_CHAT_ID not set, skipping');
      return new Response('ok');
    }

    const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });

    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('id, planning_summary, midday_sent_at, midday_status')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[midday-check] DB error:', error.message);
      return new Response('error', { status: 500 });
    }

    const row = rows?.find((r: any) =>
      r.planning_summary?.target_date === todayWarsawDate &&
      !r.planning_summary?.parse_error
    );

    if (!row) {
      console.log(`[midday-check] No plan for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    if (row.midday_sent_at || row.midday_status) {
      console.log(`[midday-check] Already sent/responded for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    const plan = row.planning_summary as Record<string, any>;
    // Backward compat: support both old and new field names
    const firstMove = plan.first_move_morning || plan.pierwszy_ruch || '—';
    const ta = plan.tension_action as { action?: string; minimum_version?: string; status?: string } | undefined;

    // Skip tension_action row if already done
    const taActive = ta?.action && ta?.status !== 'done';
    const tensionLine = taActive ? `\n\n⚡ Ruch napięciowy:\n${ta!.action}` : '';

    const text = `Check.\n\nPierwszy ruch z rana:\n${firstMove}\n\nCzy zostal zrobiony?${tensionLine}`;

    const inlineKeyboard = taActive ? [
      [
        { text: '✅ Tak', callback_data: 'midday_yes' },
        { text: '❌ Nie', callback_data: 'midday_no' },
        { text: '🔧 Utknąłem', callback_data: 'midday_stuck' }
      ],
      [
        { text: '⚡ TA: Tak', callback_data: 'midday_ta_yes' },
        { text: '⚡ TA: Nie', callback_data: 'midday_ta_no' },
        { text: '⚡ TA: Utknąłem', callback_data: 'midday_ta_stuck' }
      ]
    ] : [[
      { text: '✅ Tak', callback_data: 'midday_yes' },
      { text: '❌ Nie', callback_data: 'midday_no' },
      { text: '🔧 Utknąłem', callback_data: 'midday_stuck' }
    ]];

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        reply_markup: { inline_keyboard: inlineKeyboard },
        disable_notification: false
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'unknown');
      console.error('[midday-check] sendMessage failed:', res.status, errBody.substring(0, 100));
      return new Response('error', { status: 500 });
    }

    // Mark as sent — prevents duplicate sends if cron fires twice
    await supabase
      .from('daily_reconciliations')
      .update({ midday_sent_at: new Date().toISOString() })
      .eq('id', row.id);

    console.log(`[midday-check] Check sent for ${todayWarsawDate}.`);
    return new Response('ok');
  } catch (err) {
    console.error('[midday-check] error:', err);
    return new Response('error', { status: 500 });
  }
});
