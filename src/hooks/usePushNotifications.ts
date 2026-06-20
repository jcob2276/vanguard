import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(userId: string) {
  const isSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;

  const getSubscription = async (): Promise<PushSubscription | null> => {
    if (!isSupported) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  };

  const isSubscribed = async (): Promise<boolean> => {
    const sub = await getSubscription();
    return !!sub;
  };

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return false;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });

      const json = sub.toJSON();
      await (supabase as any).from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        keys_p256dh: json.keys?.p256dh,
        keys_auth: json.keys?.auth,
      }, { onConflict: 'user_id,endpoint' });

      return true;
    } catch (err) {
      console.error('[push] subscribe failed:', err);
      return false;
    }
  };

  const unsubscribe = async (): Promise<void> => {
    const sub = await getSubscription();
    if (!sub) return;
    await sub.unsubscribe();
    await (supabase as any).from('push_subscriptions')
      .delete().eq('user_id', userId).eq('endpoint', sub.endpoint);
  };

  return { isSupported, subscribe, unsubscribe, isSubscribed };
}
