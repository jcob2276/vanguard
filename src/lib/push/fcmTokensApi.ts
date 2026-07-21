import { supabase } from '../supabase';

export async function upsertFcmToken(userId: string, token: string, platform: 'android' | 'ios' | 'web' = 'android'): Promise<boolean> {
  const { error } = await supabase.from('push_fcm_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );
  if (error) {
    console.error('[fcm] token upsert failed:', error);
    return false;
  }
  return true;
}

export async function deleteFcmToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_fcm_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
  if (error) throw error;
}

export async function hasFcmToken(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_fcm_tokens')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[fcm] token check failed:', error);
    return false;
  }
  return !!data;
}
