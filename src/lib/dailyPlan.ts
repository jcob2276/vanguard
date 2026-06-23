import { supabase } from './supabase';
import { getTodayWarsaw } from './date';

export interface SupportingTask {
  id?: string;      // todo_item id if linked
  title: string;
  done: boolean;
}

export interface DailyPlan {
  id: string;
  user_id: string;
  plan_date: string;
  mit_task_id: string | null;
  mit_custom: string | null;
  supporting: SupportingTask[];
  energy_level: number | null;
  midday_checked: boolean;
  shutdown_note: string | null;
  shutdown_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTodayPlan(userId: string): Promise<DailyPlan | null> {
  const today = getTodayWarsaw();
  const { data, error } = await supabase
    .from('daily_plan')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', today)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DailyPlan | null;
}

export async function upsertDailyPlan(
  userId: string,
  patch: Partial<Omit<DailyPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<DailyPlan> {
  const today = getTodayWarsaw();
  const { data, error } = await supabase
    .from('daily_plan')
    .upsert(
      { user_id: userId, plan_date: today, ...patch },
      { onConflict: 'user_id,plan_date' },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DailyPlan;
}
