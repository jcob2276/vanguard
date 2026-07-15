import { supabase } from '../supabase';
import { unwrapList } from '../supabaseUtils';
import { getTodayWarsaw, shiftDateStr } from '../date';
import type { BehaviorConfounderKey } from './behaviorCapture';

/** behavior_key marking a day as an acknowledged logging gap (§5.1) — excluded from correlations. */
const LOGGING_GAP_KEY = 'przerwa_w_logowaniu';
export type LoggingGapReason = 'ok' | 'chory' | 'podroz';

export type BehaviorLogRow = {
  id: string;
  date: string;
  behavior_key: string;
  value: number | null;
  note: string | null;
};

export async function fetchBehaviorLogsSince(
  userId: string,
  sinceDate: string,
): Promise<BehaviorLogRow[]> {
  return unwrapList(await supabase
    .from('behavior_log')
    .select('id, date, behavior_key, value, note')
    .eq('user_id', userId)
    .gte('date', sinceDate)
    .order('date', { ascending: false }));
}

export async function setBehaviorConfounder(
  userId: string,
  behaviorKey: BehaviorConfounderKey,
  active: boolean,
  date = getTodayWarsaw(),
): Promise<void> {
  if (active) {
    const { error } = await supabase.from('behavior_log').upsert(
      {
        user_id: userId,
        date,
        behavior_key: behaviorKey,
        value: 1,
      },
      { onConflict: 'user_id,date,behavior_key' },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('behavior_log')
    .delete()
    .eq('user_id', userId)
    .eq('date', date)
    .eq('behavior_key', behaviorKey);
  if (error) throw error;
}

/**
 * Last date the user logged a meal. Meals are the daily-frequency signal §5.1 cares about —
 * their absence is what an unlabeled gap gets misread as (a fasting day).
 */
export async function fetchLastFoodLogDate(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('daily_food_entries')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date ?? null;
}

/** Dates already flagged as an acknowledged gap, so we don't re-prompt or double-write. */
async function fetchLoggingGapDates(userId: string, sinceDate: string): Promise<Set<string>> {
  const rows = await unwrapList(await supabase
    .from('behavior_log')
    .select('date')
    .eq('user_id', userId)
    .eq('behavior_key', LOGGING_GAP_KEY)
    .gte('date', sinceDate));
  return new Set(rows.map((r) => r.date));
}

/**
 * Writes one behavior_log row per day in [lastLoggedDate+1, today-1] not already flagged,
 * marking the gap as acknowledged so the correlation engine can exclude that window.
 */
export async function acknowledgeLoggingGap(
  userId: string,
  lastLoggedDate: string,
  reason: LoggingGapReason,
): Promise<void> {
  const today = getTodayWarsaw();
  const alreadyFlagged = await fetchLoggingGapDates(userId, shiftDateStr(lastLoggedDate, 1));

  const gapDates: string[] = [];
  for (let d = shiftDateStr(lastLoggedDate, 1); d < today; d = shiftDateStr(d, 1)) {
    if (!alreadyFlagged.has(d)) gapDates.push(d);
  }
  if (gapDates.length === 0) return;

  const { error } = await supabase.from('behavior_log').upsert(
    gapDates.map((date) => ({
      user_id: userId,
      date,
      behavior_key: LOGGING_GAP_KEY,
      value: 1,
      note: reason,
    })),
    { onConflict: 'user_id,date,behavior_key' },
  );
  if (error) throw error;
}
