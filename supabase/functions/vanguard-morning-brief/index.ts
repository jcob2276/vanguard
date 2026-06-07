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
import { logAuditEvent } from "../_shared/audit.ts";
import { getPlanQualitySignal } from "../_shared/planQuality.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { getRecentStrongBehavioralPatterns, markPatternAsShown, getRecentEarlyWarnings } from "../_shared/vanguardPatterns.ts";

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
      .select('id, planning_summary, answered_at, morning_sent_at, p2_parsed')
      .eq('user_id', VANGUARD_USER_ID)
      .not('planning_summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    // BACKLOG-03: Check if we have fresh Oura data for last night
    const { data: ouraLatest } = await supabase
      .from('oura_daily_summary')
      .select('date, total_sleep_hours, readiness_score')
      .eq('user_id', VANGUARD_USER_ID)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sleepDataStatus = ouraLatest?.date === todayWarsawDate ? 'current' : 'pending';

    if (error) {
      console.error('[morning-brief] DB error:', error.message);
      return new Response('error', { status: 500 });
    }

    const row = rows?.find(r =>
      r.planning_summary?.target_date === todayWarsawDate &&
      !r.planning_summary?.parse_error
    );

    // Sprawdź jakość planu z poprzedniego wieczoru (używamy wspólnej warstwy)
    const plan = row?.planning_summary as Record<string, any> | undefined;
    const qualitySignal = getPlanQualitySignal(plan);
    const isLowQualityPlan = qualitySignal.isLowQuality;

    if (!row || isLowQualityPlan) {
      // No good plan (or only low-quality/rescue/minimum plan) for today
      const { data: rescueExisting } = await supabase
        .from('daily_reconciliations')
        .select('id')
        .eq('user_id', VANGUARD_USER_ID)
        .eq('date', todayWarsawDate)
        .eq('mode', 'morning_rescue')
        .maybeSingle();

      if (rescueExisting) {
        console.log(`[morning-brief] Rescue already sent for ${todayWarsawDate}, skipping.`);
        return new Response('ok');
      }

      const reason = !row ? 'no_plan' : 'low_quality_plan';
      const qualityInfo = plan ? {
        plan_quality: qualitySignal.quality,
        mode: qualitySignal.mode,
        plan_failure_reason: qualitySignal.failureReason,
      } : null;

      const isVeryWeak = qualitySignal.isVeryWeak;

      logAuditEvent({
        eventType: 'morning_rescue_sent',
        severity: isVeryWeak ? 'error' : 'warning',
        message: !row
          ? 'Brak planu na dziś – wysłano rescue brief'
          : 'Słaby plan z poprzedniego wieczoru – wymuszono mocniejszy rescue',
        metadata: { date: todayWarsawDate, reason, previous_plan: qualityInfo, very_weak: isVeryWeak }
      });

      const rescueText = isVeryWeak
        ? `Wczorajszy plan był bardzo słaby (awaria/minimum).\n\n` +
          `Zanim ruszysz dziś — nagraj **lepszą** wersję:\n` +
          `1. Co ma realnie powstać po pierwszym bloku?\n` +
          `2. Jaki ruch napięciowy odkładasz?`
        : `Wczorajszy plan był słaby.\n\n` +
          `Zanim zaczniesz — nagraj:\n` +
          `1. Co ma fizycznie istnieć po pierwszym bloku?\n` +
          `2. Jaki jest ruch napięciowy na dziś?`;

      const rescueRes = await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, rescueText, {
        disableNotification: false,
      });

      if (!rescueRes.ok) {
        console.error('[morning-brief] rescue sendMessage failed:', rescueRes.status);
        return new Response('ok');
      }

      const rescueBody = await rescueRes.json().catch(() => ({}));
      const rescueMsgId = rescueBody?.result?.message_id ?? null;

      const { error: rescueInsertErr } = await supabase
        .from('daily_reconciliations')
        .insert({
          user_id:             VANGUARD_USER_ID,
          date:                todayWarsawDate,
          mode:                'morning_rescue',
          status:              'sent',
          morning_sent_at:     new Date().toISOString(),
          telegram_message_id: rescueMsgId,
          // Placeholder planning_summary so morning-ping can detect this row
          planning_summary: {
            target_date:        todayWarsawDate,
            mode:               'rescue',
            one_clear_move:     'Zdefiniuj plan dnia',
            production_artifact: { minimum_version: 'Nagraj plan' },
          },
        });

      if (rescueInsertErr) {
        console.error('[morning-brief] rescue insert failed:', rescueInsertErr.message);
      } else {
        console.log(`[morning-brief] Rescue brief sent for ${todayWarsawDate}, msg_id=${rescueMsgId}.`);
      }

      return new Response('ok');
    }

    if (row.morning_sent_at) {
      console.log(`[morning-brief] Already sent for ${todayWarsawDate}, skipping.`);
      return new Response('ok');
    }

    const planForBrief = row.planning_summary as Record<string, any>;
    const oneClearMove = planForBrief.one_clear_move || '—';
    const prodArtifact = planForBrief.production_artifact as { artifact?: string; minimum_version?: string } | undefined;
    const prodArtifactName = prodArtifact?.artifact || '—';
    const ta = planForBrief.tension_action as { action?: string; status?: string } | undefined;
    const taAction = ta?.action || '—';

    const qualityNote = isLowQualityPlan
      ? `\n\n⚠️ Wczorajszy plan był awaryjny / minimum. Warto doprecyzować dziś rano.`
      : '';

    // Light P2 adoption: yesterday evening's own reflection (if confident)
    const p2 = row?.p2_parsed as any;
    let p2Note = '';
    if (p2 && p2.parse_confidence >= 0.5 && (p2.biggest_cost || p2.best_move || p2.blocker_candidates?.length)) {
      p2Note = `\n\nWczorajsza Twoja refleksja:`;
      if (p2.biggest_cost) p2Note += `\n• Największy koszt: ${p2.biggest_cost}`;
      if (p2.best_move) p2Note += `\n• Najlepszy ruch: ${p2.best_move}`;
      if (p2.blocker_candidates?.length) {
        const blockers = p2.blocker_candidates.slice(0, 3).join('; ');
        p2Note += `\n• Blokery, które nazwałeś: ${blockers}`;
      }
    }

    // Etap 1: Lekka iniekcja najsilniejszego powtarzalnego wzorca (jeśli jest bardzo mocny)
    let patternNote = '';
    try {
      const strongPatterns = await getRecentStrongBehavioralPatterns(supabase, VANGUARD_USER_ID, 1);
      if (strongPatterns.length > 0 && strongPatterns[0].confidence >= 0.65) {
        const p = strongPatterns[0];
        const short = p.evidence_text.length > 160 ? p.evidence_text.substring(0, 157) + '...' : p.evidence_text;
        patternNote = `\n\nSchemat z Twoich danych:\n${short}`;
      }
    } catch (e) {
      console.warn('[morning-brief] pattern fetch failed (non-fatal)');
    }

    // Etap 1: Lekkie Early Warning w porannym briefie (gdy sygnał jest aktywny)
    let earlyWarningNote = '';
    try {
      const recentWarnings = await getRecentEarlyWarnings(supabase, VANGUARD_USER_ID, 1);

      if (recentWarnings.length > 0) {
        const w = recentWarnings[0];
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

        // Nie pokazuj tego samego ostrzeżenia dwa razy w ciągu jednego dnia
        if (w.last_shown === today) {
          // już pokazane dzisiaj → nic nie dodajemy
        } else {
          const short = w.evidence_text.length > 140 ? w.evidence_text.substring(0, 137) + '...' : w.evidence_text;
          earlyWarningNote = `\n\n⚠️ Wczesny sygnał aktywny:\n${short}`;

          // Podstawowe logowanie/audyt: zaznaczamy, że ostrzeżenie zostało pokazane rano
          if (w.id) {
            await markPatternAsShown(supabase, w.id);
          }
        }
      }
    } catch (e) {
      console.warn('[morning-brief] early warning fetch failed (non-fatal)');
    }

    const text = 
      `Start dnia.\n\n` +
      (sleepDataStatus === 'pending' 
        ? `Sen z ostatniej nocy (Oura): pending — dane jeszcze nie zsynchronizowane\n\n`
        : '') +
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
      `${taAction}${qualityNote}${p2Note}${patternNote}${earlyWarningNote}`;

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

    const { error: updateErr } = await supabase
      .from('daily_reconciliations')
      .update({ morning_sent_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateErr) console.error('[morning-brief] failed to update morning_sent_at:', updateErr.message);

    console.log(`[morning-brief] Start message sent for ${todayWarsawDate}, row ${row.id}.`);
    return new Response('ok');
  } catch (err) {
    await logCriticalError({
      area: 'morning-brief',
      error: err,
      message: 'Morning brief cron failed',
    });
    return new Response('error', { status: 500 });
  }
});
