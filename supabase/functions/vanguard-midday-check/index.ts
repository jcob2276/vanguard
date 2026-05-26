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
import { sendMessage } from "../_shared/telegram.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const VANGUARD_USER_ID = getVanguardUserId();
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createServiceClient();

serve(async () => {
  try {
    if (!TELEGRAM_CHAT_ID) {
      console.warn('[midday-check] TELEGRAM_CHAT_ID not set, skipping');
      return new Response('ok');
    }

    const todayWarsawDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('id, planning_summary, midday_sent_at, midday_status')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('created_at', { ascending: false })
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
    const prodArtifact = plan.production_artifact as { artifact?: string; minimum_version?: string } | undefined;
    const prodArtifactName = prodArtifact?.artifact || '—';
    const ta = plan.tension_action as { action?: string; status?: string } | undefined;
    const taAction = ta?.action || '—';

    const text =
      `Check.\n\n` +
      `Artefakt:\n` +
      `${prodArtifactName}\n` +
      `Status?\n\n` +
      `Tension action:\n` +
      `${taAction}`;

    const inlineKeyboard = [
      [
        { text: '✅ Done', callback_data: 'midday_artifact_done' },
        { text: '❌ Nie', callback_data: 'midday_artifact_no' },
        { text: '🔧 Utknąłem', callback_data: 'midday_artifact_stuck' }
      ],
      [
        { text: '⚡ TA Done', callback_data: 'midday_ta_done' },
        { text: '⚡ TA Nie', callback_data: 'midday_ta_no' },
        { text: '⚡ TA Utknąłem', callback_data: 'midday_ta_stuck' }
      ]
    ];

    const res = await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
      replyMarkup: { inline_keyboard: inlineKeyboard },
      disableNotification: false,
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
