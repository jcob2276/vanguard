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
import { getVanguardUserId } from "../_shared/constants.ts";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const VANGUARD_USER_ID = getVanguardUserId();
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createServiceClient();

serve(async () => {
  try {
    if (!TELEGRAM_CHAT_ID) {
      console.warn('[morning-brief] TELEGRAM_CHAT_ID not set, skipping');
      return new Response('ok');
    }

    const todayWarsawDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('id, planning_summary, answered_at, morning_sent_at')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('created_at', { ascending: false })
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
    const oneClearMove = plan.one_clear_move || '—';
    const prodArtifact = plan.production_artifact as { artifact?: string; minimum_version?: string } | undefined;
    const prodArtifactName = prodArtifact?.artifact || '—';
    const ta = plan.tension_action as { action?: string; status?: string } | undefined;
    const taAction = ta?.action || '—';

    const text = 
      `Start dnia.\n\n` +
      `Telefon nie jest pierwszy.\n\n` +
      `Pierwsze 90 minut:\n` +
      `→ bez scrolla\n` +
      `→ bez YouTube\n` +
      `→ bez AI loopa\n` +
      `→ bez reorganizacji systemu\n\n` +
      `Pierwszy blok:\n` +
      `${oneClearMove}\n\n` +
      `Artefakt po bloku:\n` +
      `${prodArtifactName}\n\n` +
      `⚡ Ruch napięciowy:\n` +
      `${taAction}`;

    const res = await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '🚀 Start 90', callback_data: 'morning_start' },
            { text: '⚡ Minimum 20', callback_data: 'morning_minimum_20' }
          ],
          [
            { text: '😵 Wstałem za późno', callback_data: 'morning_late' },
            { text: '📋 Pokaż plan', callback_data: 'morning_show_plan' }
          ]
        ]
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
