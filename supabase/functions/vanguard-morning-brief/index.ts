/**
 * vanguard-morning-brief
 *
 * Cron: 05:00 UTC daily = 07:00 Warsaw (CEST) / 06:00 (CET)
 * Sends the day's plan from last night's planning session.
 * Silently skips if no plan exists for today (no reconciliation / planning not done).
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
      console.warn('[morning-brief] TELEGRAM_CHAT_ID not set, skipping');
      return new Response('ok');
    }

    // Warsaw-aware today date — avoids UTC midnight bug
    const todayWarsawDate = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });

    // Fetch last few plans and filter in code (jsonb field comparison)
    const { data: rows, error } = await supabase
      .from('daily_reconciliations')
      .select('planning_summary, answered_at')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[morning-brief] DB error:', error.message);
      return new Response('error', { status: 500 });
    }

    const todayPlan = rows?.find(r =>
      r.planning_summary?.target_date === todayWarsawDate &&
      !r.planning_summary?.parse_error
    )?.planning_summary as Record<string, any> | undefined;

    if (!todayPlan) {
      console.log(`[morning-brief] No plan for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    const top3 = ((todayPlan.top3 as string[]) || [])
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');

    // Backward compat: support both old and new field names
    const firstMove = todayPlan.first_move_morning || todayPlan.pierwszy_ruch || '—';
    const biggestRisk = todayPlan.biggest_risk || todayPlan.ryzyko || '—';
    const counter = todayPlan.counterplan || todayPlan.kontrplan || '—';
    const mvd = todayPlan.minimum_viable_day;

    const urgentItems = (todayPlan.urgent_items as string[] || []).filter(Boolean);
    const urgentSection = urgentItems.length > 0
      ? `\n\nPilne:\n${urgentItems.map(u => `• ${u}`).join('\n')}`
      : (todayPlan.pilne && todayPlan.pilne !== 'null' ? `\n\nPilne:\n${todayPlan.pilne}` : '');

    const ta = todayPlan.tension_action as { action?: string; minimum_version?: string; due_time?: string } | undefined;
    const tensionSection = ta?.action
      ? `\n\n⚡ Ruch napięciowy:\n${ta.action}\nMinimum: ${ta.minimum_version || '—'}\nDo: ${ta.due_time || '—'}`
      : '';
    const adversaryNoteSection = todayPlan.adversary_note
      ? `\n\n🔍 ${todayPlan.adversary_note}`
      : '';

    const text =
      `Dzien dobry.\n\nFirst move:\n${firstMove}\n\nTop 3:\n${top3}${mvd ? `\n\nMinimum viable day:\n${mvd}` : ''}${tensionSection}${adversaryNoteSection}\n\nRyzyko:\n${biggestRisk}\n\nKontrplan:\n${counter}${urgentSection}`;

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        disable_notification: false
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'unknown');
      console.error('[morning-brief] sendMessage failed:', res.status, errBody.substring(0, 100));
      return new Response('error', { status: 500 });
    }

    console.log(`[morning-brief] Plan sent for ${todayWarsawDate}.`);
    return new Response('ok');
  } catch (err) {
    console.error('[morning-brief] error:', err);
    return new Response('error', { status: 500 });
  }
});
