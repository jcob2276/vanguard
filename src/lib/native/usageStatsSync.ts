/**
 * Native Usage Stats → phone_usage_daily sync (Android only).
 */
import { App } from '@capacitor/app';
import {
  buildPhoneUsageDailyPayload,
  getWarsawDateString,
  warsawDayStartUTCMs,
} from '@vanguard/domain';
import { upsertPhoneUsageDaily } from '../phoneUsageApi';
import { notify } from '../notify';
import { supabase } from '../supabase';
import { isNativePlatform } from './platform';
import { UsageStats } from './usageStatsPlugin';

const SYNC_THROTTLE_MS = 15 * 60 * 1000;

let lastSyncAt = 0;
let activeUserId: string | null = null;
let teardown: (() => void) | null = null;

export interface PhoneUsageSyncResult {
  ok: boolean;
  totalMinutes?: number;
  error?: string;
  skipped?: boolean;
}

export async function syncPhoneUsageToday(
  userId: string,
  force = false,
  options?: { silent?: boolean },
): Promise<PhoneUsageSyncResult> {
  if (!isNativePlatform() || !userId) {
    return { ok: false, error: 'not_native' };
  }

  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_THROTTLE_MS) {
    return { ok: false, skipped: true };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: 'not_authenticated' };
    }

    const access = await UsageStats.hasAccess();
    if (!access.granted) {
      return { ok: false, error: 'usage_access_denied' };
    }

    const dateStr = getWarsawDateString();
    const beginMs = warsawDayStartUTCMs(dateStr);
    const snapshot = await UsageStats.getDailySnapshot({ beginMs, endMs: now });
    const payload = buildPhoneUsageDailyPayload(session.user.id, dateStr, snapshot);
    const upsert = await upsertPhoneUsageDaily(payload);
    if (!upsert.ok) {
      return { ok: false, error: upsert.error ?? 'upsert_failed' };
    }

    lastSyncAt = now;

    if (!options?.silent) {
      const toastKey = `phone-usage-sync-toast-${dateStr}`;
      if (!localStorage.getItem(toastKey)) {
        notify(`Czas ekranu zapisany (${payload.total_minutes} min)`, 'success');
        localStorage.setItem(toastKey, '1');
      }
    }

    return { ok: true, totalMinutes: payload.total_minutes };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'sync_failed';
    console.error('[phone-usage] sync failed:', err);
    return { ok: false, error: message };
  }
}

export function initUsageStatsSync(userId: string): () => void {
  if (!isNativePlatform() || !userId) return () => {};

  if (teardown && activeUserId === userId) return teardown;

  teardown?.();
  activeUserId = userId;
  lastSyncAt = 0;

  const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && activeUserId) {
      void syncPhoneUsageToday(activeUserId, false, { silent: false });
    }
  });

  void syncPhoneUsageToday(userId, true, { silent: false });

  teardown = () => {
    void resumeListener.then((h) => h.remove());
    if (activeUserId === userId) {
      activeUserId = null;
      teardown = null;
    }
  };

  return teardown;
}

export async function hasUsageStatsAccess(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const access = await UsageStats.hasAccess();
    return access.granted;
  } catch {
    return false;
  }
}

export async function openUsageStatsSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  await UsageStats.openAccessSettings();
}
