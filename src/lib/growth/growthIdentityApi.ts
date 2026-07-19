import { supabase } from '../supabase';
import type { Database } from '../database.types';
import type { VanguardIdentityData } from './growth.types';

async function fetchVanguardIdentity(userId: string): Promise<VanguardIdentityData | null> {
  const { data, error } = await supabase
    .from('vanguard_identity')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as VanguardIdentityData | null;
}

export async function updateVanguardIdentity(userId: string, updates: Partial<VanguardIdentityData>): Promise<void> {
  const insertData = {
    user_id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  } as Database['public']['Tables']['vanguard_identity']['Insert'];

  const { error } = await supabase
    .from('vanguard_identity')
    .upsert(insertData);

  if (error) throw error;
}
