import { supabase } from './supabase';
import type { PhoneUsageDailyPayload } from '@vanguard/domain';

export async function upsertPhoneUsageDaily(
  payload: PhoneUsageDailyPayload,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('phone_usage_daily').upsert(
    {
      user_id: payload.user_id,
      date: payload.date,
      total_minutes: payload.total_minutes,
      late_night_minutes: payload.late_night_minutes,
      social_minutes: payload.social_minutes,
      messaging_minutes: payload.messaging_minutes,
      entertainment_minutes: payload.entertainment_minutes,
      ai_minutes: payload.ai_minutes,
      browser_minutes: payload.browser_minutes,
      unlocks: payload.unlocks,
      top_apps: payload.top_apps,
    },
    { onConflict: 'user_id,date' },
  );
  if (error) {
    console.error('[phone-usage] upsert failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchPhoneUsageDaily(userId: string, date: string) {
  const { data, error } = await supabase
    .from('phone_usage_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchPhoneUsageRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('phone_usage_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

