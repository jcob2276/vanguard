import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { todoKeys } from '../../../lib/todo/todoApi';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { useTodoKeyboard } from './useTodoKeyboard';

interface UseTodoLifecycleEffectsProps {
  userId: string;
  queryClient: QueryClient;
  push: ReturnType<typeof usePushNotifications>;
  setPushSubscribed: (v: boolean | null) => void;
  setExpandedId: (id: string | null) => void;
  setContextMenu: (menu: null) => void;
}

export function useTodoLifecycleEffects({
  userId, queryClient, push, setPushSubscribed, setExpandedId, setContextMenu,
}: UseTodoLifecycleEffectsProps) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`todo_items_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todo_items', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: todoKeys.items(userId) });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  useEffect(() => {
    push.isSubscribed().then(setPushSubscribed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTodoKeyboard({ setExpandedId, setContextMenu });
}
