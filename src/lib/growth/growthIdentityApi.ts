import { supabase } from '../supabase';
import type { Database } from '../database.types';
import type { VanguardIdentityData } from './growth.types';

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
