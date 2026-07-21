import { supabase } from '../lib/supabase';
import { isNativePlatform } from '../lib/native/platform';
import { isNativePushRegistered, registerNativePush } from '../lib/native/nativePush';
import { deleteFcmToken } from '../lib/push/fcmTokensApi';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(userId: string) {
  const native = isNativePlatform();
  const webSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
  const isSupported = native || webSupported;

  const getSubscription = async (): Promise<PushSubscription | null> => {
    if (native || !webSupported) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  };

  const isSubscribed = async (): Promise<boolean> => {
    if (!userId) return false;
    if (native) return isNativePushRegistered(userId);

    const sub = await getSubscription();
    if (!sub || Notification.permission !== 'granted') return false;

    const json = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: json.endpoint ?? sub.endpoint,
      keys_p256dh: json.keys?.p256dh ?? '',
      keys_auth: json.keys?.auth ?? '',
    }, { onConflict: 'user_id,endpoint' });

    if (error) {
      console.error('[push] subscription sync failed:', error);
      return false;
    }
    return true;
  };

  const subscribe = async (): Promise<boolean> => {
    if (!userId) return false;
    if (native) return registerNativePush(userId);

    if (!webSupported || !VAPID_PUBLIC_KEY) return false;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });

      const json = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint ?? '',
        keys_p256dh: json.keys?.p256dh ?? '',
        keys_auth: json.keys?.auth ?? '',
      }, { onConflict: 'user_id,endpoint' });

      if (error) throw error;

      return true;
    } catch (err: unknown) {
      console.error('[push] subscribe failed:', err);
      return false;
    }
  };

  const unsubscribe = async (): Promise<void> => {
    if (native) {
      const { data } = await supabase
        .from('push_fcm_tokens')
        .select('token')
        .eq('user_id', userId);
      for (const row of data ?? []) {
        await deleteFcmToken(userId, row.token);
      }
      return;
    }

    const sub = await getSubscription();
    if (!sub) return;
    const { error } = await supabase.from('push_subscriptions')
      .delete().eq('user_id', userId).eq('endpoint', sub.endpoint);
    if (error) throw error;
    await sub.unsubscribe();
  };

  return { isSupported, subscribe, unsubscribe, isSubscribed };
}
