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
import { getVanguardUserId } from "../_shared/constants.ts";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const VANGUARD_USER_ID = getVanguardUserId();
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

const supabase = createServiceClient();

serve(async () => {
  try {
    if (!TELEGRAM_CHAT_ID) return new Response('ok');

    const todayWarsawDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('id, planning_summary, morning_sent_at, morning_clicked_at, morning_ping_sent_at, first_90_started_at')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[morning-ping] DB error:', error.message);
      return new Response('error', { status: 500 });
    }

    const row = rows?.find((r: any) =>
      r.planning_summary?.target_date === todayWarsawDate &&
      !r.planning_summary?.parse_error &&
      r.morning_sent_at &&        // brief was sent
      !r.morning_clicked_at &&    // but no interaction yet
      !r.first_90_started_at &&   // skip if first_90_started_at exists
      !r.morning_ping_sent_at     // and ping hasn't been sent yet
    );

    if (!row) {
      console.log(`[morning-ping] No unresponded brief for ${todayWarsawDate} or first_90_started_at exists, skipping.`);
      return new Response('ok');
    }

    const plan = row.planning_summary as Record<string, any>;
    const prodArtifact = plan.production_artifact as { artifact?: string; minimum_version?: string } | undefined;
    const minVersion = prodArtifact?.minimum_version || '—';

    const text =
      `Brak sygnału.\n` +
      `Zakładam telefon albo drift.\n\n` +
      `Minimum teraz:\n` +
      `${minVersion}`;

    const res = await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
      replyMarkup: {
        inline_keyboard: [[
          { text: '⚡ Start 20', callback_data: 'morning_minimum_20' },
          { text: '📱 Telefon odłożony', callback_data: 'morning_phone_aside' },
          { text: '🔧 Utknąłem', callback_data: 'morning_stuck' }
        ]]
      },
      disableNotification: false,
    });

    if (!res.ok) {
      console.error('[morning-ping] sendMessage failed:', res.status);
      return new Response('error', { status: 500 });
    }

    await supabase
      .from('daily_reconciliations')
      .update({ morning_ping_sent_at: new Date().toISOString() })
      .eq('id', row.id);

    console.log(`[morning-ping] Drift ping sent for ${todayWarsawDate}, row ${row.id}.`);
    return new Response('ok');
  } catch (err) {
    console.error('[morning-ping] error:', err);
    return new Response('error', { status: 500 });
  }
});
