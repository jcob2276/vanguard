import { supabase } from './supabase';
import type { Tables } from './database.types';

export type UserFundamentRow = Tables<'user_fundament'>;

export async function fetchUserFundament(userId: string): Promise<UserFundamentRow | null> {
  const { data } = await supabase
    .from('user_fundament')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function upsertUserFundament(userId: string, patch: Record<string, string>): Promise<void> {
  const { error } = await supabase
    .from('user_fundament')
    .upsert({
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}
