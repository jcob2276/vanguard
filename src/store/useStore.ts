import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

type VanguardStore = {
  session: Session | null;
  userSettings: Tables<'user_settings'> | null;
  todayWin: Tables<'daily_wins'> | null;
  isSyncing: boolean;
  setSession: (session: Session | null) => void;
  fetchUserSettings: () => Promise<void>;
  fetchTodayWin: () => Promise<void>;
  setSyncing: (isSyncing: boolean) => void;
};

export const useStore = create<VanguardStore>((set, get) => ({
  session: null,
  userSettings: null,
  todayWin: null,
  isSyncing: false,
  
  setSession: (session: Session | null) => set({ session }),
  
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
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const { data } = await supabase
      .from('daily_wins')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', today)
      .maybeSingle();
    
    set({ todayWin: data });
  },

  setSyncing: (isSyncing: boolean) => set({ isSyncing })
}));
