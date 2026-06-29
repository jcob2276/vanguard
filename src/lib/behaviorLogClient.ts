import { supabase } from './supabase';
import { unwrapList } from './supabaseUtils';
import { getTodayWarsaw } from './date';
import type { BehaviorConfounderKey } from './behaviorCapture';

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
