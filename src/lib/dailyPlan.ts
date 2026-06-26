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
  mit_confidence: number | null;
  avoided_task: string | null;
  supporting: SupportingTask[];
  energy_level: number | null;
  midday_checked: boolean;
  shutdown_note: string | null;
  shutdown_at: string | null;
  re_entry_mode: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPlanForDate(userId: string, dateStr: string): Promise<DailyPlan | null> {
  const { data, error } = await supabase
    .from('daily_plan')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', dateStr)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as DailyPlan | null;
}

export async function getTodayPlan(userId: string): Promise<DailyPlan | null> {
  return getPlanForDate(userId, getTodayWarsaw());
}

export async function upsertPlanForDate(
  userId: string,
  dateStr: string,
  patch: Partial<Omit<DailyPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<DailyPlan> {
  const { data, error } = await supabase
    .from('daily_plan')
    .upsert(
      { user_id: userId, plan_date: dateStr, ...patch } as never,
      { onConflict: 'user_id,plan_date' },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as DailyPlan;
}

export async function upsertDailyPlan(
  userId: string,
  patch: Partial<Omit<DailyPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<DailyPlan> {
  return upsertPlanForDate(userId, getTodayWarsaw(), patch);
}

export async function checkReEntryMode(userId: string): Promise<boolean> {
  const today = getTodayWarsaw();
  const { data, error } = await supabase
    .from('daily_plan')
    .select('plan_date')
    .eq('user_id', userId)
    .lt('plan_date', today)
    .order('plan_date', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (error) {
    console.error('[dailyPlan] checkReEntryMode error', error);
    return false;
  }
  
  // If no previous plan ever, maybe it's the first time using the app. No re-entry mode needed.
  if (!data) return false;
  
  // Calendar-day diff using noon UTC anchors (same pattern as getDaysAgoWarsaw)
  const t1 = new Date(`${today}T12:00:00Z`).getTime();
  const t2 = new Date(`${data.plan_date}T12:00:00Z`).getTime();
  const diffDays = Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
  
  // If difference is >= 2 days (meaning they skipped yesterday), trigger re-entry mode
  return diffDays >= 2;
}
