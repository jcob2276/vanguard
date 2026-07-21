/**
 * Capacitor FCM registration — no-op outside native shell.
 */
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { hasFcmToken, upsertFcmToken } from '../push/fcmTokensApi';

let listenersAttachedForUser: string | null = null;

async function persistToken(userId: string, token: string): Promise<boolean> {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  return upsertFcmToken(userId, token, platform);
}

export async function registerNativePush(userId: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !userId) return false;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return false;

    if (listenersAttachedForUser !== userId) {
      await PushNotifications.removeAllListeners();
      await PushNotifications.addListener('registration', (event) => {
        void persistToken(userId, event.value);
      });
      await PushNotifications.addListener('registrationError', (event) => {
        console.error('[fcm] registration error:', event.error);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification.data?.url;
        if (typeof url === 'string' && url.length > 0) {
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
      listenersAttachedForUser = userId;
    }

    await PushNotifications.register();
    return true;
  } catch (err: unknown) {
    console.error('[fcm] register failed:', err);
    return false;
  }
}

export async function isNativePushRegistered(userId: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !userId) return false;
  return hasFcmToken(userId);
}
