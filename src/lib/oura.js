import { supabase } from './supabase';

export async function syncOuraData(userId) {
  try {
    const { error } = await supabase.functions.invoke('sync-oura', {
      body: { userId }
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Edge Function error:', error);
    return { success: false, error: error.message };
  }
}

// updateDisciplinedStreak is no longer needed here as it's handled server-side

