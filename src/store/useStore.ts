import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

type VanguardStore = {
  session: Session | null;
  isSyncing: boolean;
  setSession: (session: Session | null) => void;
  setSyncing: (isSyncing: boolean) => void;
};

export const useStore = create<VanguardStore>((set) => ({
  session: null,
  isSyncing: false,

  setSession: (session: Session | null) => set({ session }),
  setSyncing: (isSyncing: boolean) => set({ isSyncing })
}));

export const useSession = () => useStore((state) => state.session);
export const useUserId = () => useStore((state) => state.session?.user.id);
