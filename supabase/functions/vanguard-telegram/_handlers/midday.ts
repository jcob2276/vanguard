/**
 * midday.ts — Midday check + tension action + blocker callback handlers.
 * Obsługuje: midday_artifact_*, midday_ta_*, midday_block_*, midday_yes/no/stuck
 */

import { safeSendTelegram } from '../_utils/helpers.ts';
import { ackCallback } from '../_utils/callbackAck.ts';

export const MIDDAY_ARTIFACT_CALLBACKS = [
  'midday_yes', 'midday_no', 'midday_stuck',
  'midday_artifact_done', 'midday_artifact_no', 'midday_artifact_stuck'
];

export const MIDDAY_TA_CALLBACKS = [
  'midday_ta_yes', 'midday_ta_no', 'midday_ta_stuck', 'midday_ta_done'
];

export const MIDDAY_BLOCK_CALLBACKS = [
  'midday_block_energy', 'midday_block_clarity', 'midday_block_resistance', 'midday_block_external'
];

async function getTodayPlanRow(supabase: any, userId: string) {
  const todayWarsawDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const { data: planRows } = await supabase
    .from('daily_reconciliations')
    .select('id, planning_summary')
    .eq('user_id', userId)
    .not('planning_summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  const planRow = (planRows || []).find((r: any) =>
    r.planning_summary?.target_date === todayWarsawDate && !r.planning_summary?.parse_error
  );
  return planRow;
}


export async function handleMiddayArtifactCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  userId: string
): Promise<void> {
  const planRow = await getTodayPlanRow(supabase, userId);
  const plan = planRow?.planning_summary as any;
  const prodArtifact = plan?.production_artifact as { artifact?: string; minimum_version?: string } | undefined;

  if (planRow?.id) {
    const statusMap: Record<string, string> = {
      midday_yes: 'done', midday_artifact_done: 'done',
      midday_no: 'not_done', midday_artifact_no: 'not_done',
      midday_stuck: 'stuck', midday_artifact_stuck: 'stuck'
    };
    const { error: updateErr } = await supabase.from('daily_reconciliations')
      .update({ midday_status: statusMap[data] })
      .eq('id', planRow.id);
    if (updateErr) {
      console.error('[midday] failed to update midday_status:', updateErr);
    }
  }

  let responseText = '';
  if (data === 'midday_yes' || data === 'midday_artifact_done') {
    responseText = 'Zapisane. Trzymaj Top 1.';
  } else {
    const minVersion = prodArtifact?.minimum_version || plan?.minimum_viable_day || '—';
    responseText = `Minimum version:\n${minVersion}`;
  }

  await ackCallback(telegramToken, callbackId, chatId, messageId);
  await safeSendTelegram(chatId, responseText, telegramToken, { disable_notification: false });
}

export async function handleMiddayTaCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  userId: string
): Promise<void> {
  const planRow = await getTodayPlanRow(supabase, userId);
  const plan = planRow?.planning_summary as any;
  const ta = plan?.tension_action;

  if (planRow?.id && ta) {
    const newStatus = (data === 'midday_ta_yes' || data === 'midday_ta_done') ? 'done' : 'skipped';
    const updatedPlan = { ...plan, tension_action: { ...ta, status: newStatus } };
    const { error: updateErr } = await supabase.from('daily_reconciliations')
      .update({ planning_summary: updatedPlan })
      .eq('id', planRow.id);
    if (updateErr) {
      console.error('[midday] failed to update tension action status in planning_summary:', updateErr);
    }
  }

  let responseText = '';
  if (data === 'midday_ta_yes' || data === 'midday_ta_done') {
    responseText = '⚡ Ruch napięciowy zrobiony. Zapisane.';
  } else {
    responseText = `Minimum version:\n${ta?.minimum_version || '—'}`;
  }

  await ackCallback(telegramToken, callbackId, chatId, messageId);
  await safeSendTelegram(chatId, responseText, telegramToken);
}

export async function handleMiddayBlockerCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  userId: string
): Promise<void> {
  const planRow = await getTodayPlanRow(supabase, userId);
  const plan = planRow?.planning_summary as any;
  const ta = plan?.tension_action as any;

  const blockerMap: Record<string, string> = {
    midday_block_energy: 'energy', midday_block_clarity: 'clarity',
    midday_block_resistance: 'resistance', midday_block_external: 'external'
  };
  if (planRow?.id) {
    const { error: updateErr } = await supabase.from('daily_reconciliations')
      .update({ midday_blocker: blockerMap[data] })
      .eq('id', planRow.id);
    if (updateErr) {
      console.error('[midday] failed to update midday blocker:', updateErr);
    }
  }

  let responseText = '';
  if (data === 'midday_block_energy') {
    responseText = `Energia niska.\n\nMinimum viable day:\n${plan?.minimum_viable_day || '—'}\n\nRobisz 10 min?`;
  } else if (data === 'midday_block_clarity') {
    const top3 = (plan?.top3 as string[] || []).map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');
    responseText = `Niejasność blokuje.\n\nTop 3 na dziś:\n${top3}\n\nKtóry punkt jest niejasny?`;
  } else if (data === 'midday_block_resistance') {
    const minVersion = ta?.minimum_version || plan?.minimum_viable_day || '—';
    responseText = `Opór.\n\nMinimum version:\n${minVersion}\n\nJeden ruch. Robisz?`;
  } else if (data === 'midday_block_external') {
    responseText = 'Zewnętrzna blokada.\n\nCo konkretnie zatrzymuje? Napisz w jednym zdaniu.';
  }

  await ackCallback(telegramToken, callbackId, chatId, messageId);
  await safeSendTelegram(chatId, responseText, telegramToken);
}
