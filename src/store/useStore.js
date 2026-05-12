import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useStore = create((set, get) => ({
  session: null,
  userSettings: null,
  todayWin: null,
  isSyncing: false,
  
  setSession: (session) => set({ session }),
  
  fetchUserSettings: async () => {
    const { session } = get();
    if (!session) return;
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (!error && data) {
      set({ userSettings: data });
    }
  },

  fetchTodayWin: async () => {
    const { session } = get();
    if (!session) return;
    
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_wins')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', today)
      .maybeSingle();
    
    set({ todayWin: data });
  },

  setSyncing: (isSyncing) => set({ isSyncing })
}));
