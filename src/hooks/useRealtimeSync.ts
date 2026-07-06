import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';

export function useRealtimeSync(session: Session | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session?.user?.id) return;

    console.log('[Realtime] Initializing Supabase realtime subscriptions...');

    const channel = supabase.channel('vanguard_realtime_ux')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items' }, () => {
        console.log('[Realtime] todo_items changed, invalidating...');
        queryClient.invalidateQueries({ queryKey: ['todos'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vanguard_notes' }, () => {
        console.log('[Realtime] vanguard_notes changed, invalidating...');
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vanguard_stream' }, () => {
        console.log('[Realtime] vanguard_stream changed, invalidating...');
        queryClient.invalidateQueries({ queryKey: ['stream'] });
      })
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    return () => {
      console.log('[Realtime] Cleaning up Supabase realtime subscriptions...');
      supabase.removeChannel(channel);
    };
  }, [session, queryClient]);
}
