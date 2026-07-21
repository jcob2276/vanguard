import { useEffect, useRef } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { todoKeys } from '../../../lib/queryKeys';
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
  const nativePushTried = useRef(false);

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

  const { data: isSubscribed } = useQuery({
    queryKey: ['todo-push-subscription', userId],
    queryFn: async () => {
      return push.isSubscribed();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (isSubscribed !== undefined) {
      setPushSubscribed(isSubscribed);
    }
  }, [isSubscribed, setPushSubscribed]);

  // Capacitor APK: one-shot FCM register when Todo opens and not yet subscribed.
  useEffect(() => {
    if (!userId || isSubscribed !== false || !push.isSupported || nativePushTried.current) return;
    nativePushTried.current = true;
    void (async () => {
      const ok = await push.subscribe();
      if (ok) setPushSubscribed(true);
    })();
  }, [userId, isSubscribed, push, setPushSubscribed]);

  useTodoKeyboard({ setExpandedId, setContextMenu });
}
