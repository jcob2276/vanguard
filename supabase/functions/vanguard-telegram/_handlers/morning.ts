/**
 * morning.ts — Morning brief callback handlers.
 * Obsługuje: morning_start, morning_show_plan, morning_late,
 *            morning_minimum_20, morning_phone_aside, morning_minimum_now,
 *            morning_change_minimum, morning_stuck
 */

import { safeSendTelegram } from '../_utils/helpers.ts';
import { ackCallback } from '../_utils/callbackAck.ts';

export const MORNING_CALLBACKS = [
  'morning_start', 'morning_show_plan', 'morning_late', 'morning_minimum_20',
  'morning_phone_aside', 'morning_minimum_now', 'morning_change_minimum', 'morning_stuck'
];

export async function handleMorningCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  userId: string
): Promise<void> {
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
  const plan = planRow?.planning_summary as any;
  const ta = plan?.tension_action as any;
  const prodArtifact = plan?.production_artifact as { artifact?: string; minimum_version?: string } | undefined;

  const updates: Record<string, any> = { morning_clicked_at: new Date().toISOString() };
  let responseText = '';
  let responseMarkup: any = undefined;

  if (data === 'morning_start') {
    updates.morning_action = 'start';
    updates.first_move_started = true;
    updates.first_90_started_at = new Date().toISOString();
    responseText = 'Zamknij Telegram. Wracasz po artefakcie.';
  } else if (data === 'morning_show_plan') {
    updates.morning_action = 'show_plan';
    const top3 = (plan?.top3 as string[] || []).map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');
    const tensionPart = ta?.action ? `\n\nRuch napięciowy:\n${ta.action}\nMinimum: ${ta.minimum_version || '—'}\nDo: ${ta.due_time || '—'}` : '';
    const notDoing = (plan?.not_doing as string[] || []).filter(Boolean);
    const notDoingPart = notDoing.length > 0 ? `\n\nNie robimy:\n${notDoing.map((u: string) => `• ${u}`).join('\n')}` : '';
    responseText =
      `Plan dnia:\n\nTop 3:\n${top3}\n\n` +
      `Minimum viable day:\n${plan?.minimum_viable_day || '—'}` +
      notDoingPart +
      `\n\nNajwiększe ryzyko:\n${plan?.biggest_risk || plan?.ryzyko || '—'}\n\nKontrplan:\n${plan?.counterplan || plan?.kontrplan || '—'}` +
      tensionPart;
  } else if (data === 'morning_late') {
    updates.morning_action = 'late';
    updates.phone_drift_morning = true;
    updates.compression_mode_used = true;
    const minVersion = prodArtifact?.minimum_version || plan?.minimum_viable_day || '—';
    responseText = `Nie nadrabiamy dnia. Ratujemy pierwszy artefakt.\n\nMinimum na teraz:\n${minVersion}`;
  } else if (data === 'morning_minimum_20') {
    updates.morning_action = 'minimum_20';
    updates.compression_mode_used = true;
    const minVersion = prodArtifact?.minimum_version || plan?.minimum_viable_day || '—';
    responseText = `Minimum na teraz:\n${minVersion}`;
  } else if (data === 'morning_phone_aside') {
    updates.morning_action = 'phone_aside';
    responseText = 'Telefon odłożony. Zrób pierwszy blok.';
  } else if (data === 'morning_minimum_now') {
    updates.morning_action = 'minimum_now';
    updates.first_move_started = true;
    const mvd = plan?.minimum_viable_day || plan?.first_move_morning || plan?.pierwszy_ruch || '—';
    responseText = `Dobrze. 10 minut na:\n${mvd}`;
  } else if (data === 'morning_change_minimum') {
    updates.morning_action = 'change_minimum';
    responseText = 'Napisz swoje minimum na dziś:';
  } else if (data === 'morning_stuck') {
    updates.morning_action = 'stuck';
    responseText = 'Blokada.\n\nCo blokuje?';
    responseMarkup = { inline_keyboard: [[
      { text: '🔋 Energia', callback_data: 'midday_block_energy' },
      { text: '❓ Niejasność', callback_data: 'midday_block_clarity' },
      { text: '⚡ Opór', callback_data: 'midday_block_resistance' },
      { text: '🌍 Zewnętrzne', callback_data: 'midday_block_external' }
    ]]};
  }

  await ackCallback(telegramToken, callbackId, chatId, messageId);

  if (responseText) {
    await safeSendTelegram(chatId, responseText, telegramToken, {
      reply_markup: responseMarkup
    });
  }
  if (planRow?.id) {
    const { error: updateErr } = await supabase.from('daily_reconciliations').update(updates).eq('id', planRow.id);
    if (updateErr) {
      console.error('[morning] failed to update morning callback action metrics:', updateErr);
    }
  }
}
