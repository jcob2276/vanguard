/**
 * Foreground service orchestration + periodic sync ticks (Android APK).
 */
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { STORAGE_KEYS } from '../constants';
import { syncLocationNow } from './locationSync';
import { isNativePlatform } from './platform';
import { syncPhoneUsageToday } from './usageStatsSync';
import { BackgroundSync } from './backgroundSyncPlugin';

let serviceRunning = false;
let activeUserId: string | null = null;
let teardown: (() => void) | null = null;

export function isBackgroundSyncRunning(): boolean {
  return serviceRunning;
}

export function isBackgroundSyncEnabled(): boolean {
  if (!isNativePlatform()) return false;
  const stored = localStorage.getItem(STORAGE_KEYS.BACKGROUND_SYNC_ENABLED);
  return stored !== '0';
}

function setBackgroundSyncEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEYS.BACKGROUND_SYNC_ENABLED, enabled ? '1' : '0');
}

export async function refreshBackgroundSyncRunning(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { running } = await BackgroundSync.isRunning();
    serviceRunning = running;
    return running;
  } catch {
    serviceRunning = false;
    return false;
  }
}

export async function startBackgroundSync(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { running } = await BackgroundSync.start();
    serviceRunning = running;
    setBackgroundSyncEnabled(true);
    return running;
  } catch (err) {
    console.error('[background-sync] start failed:', err);
    return false;
  }
}

export async function stopBackgroundSync(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await BackgroundSync.stop();
    serviceRunning = false;
    setBackgroundSyncEnabled(false);
  } catch (err) {
    console.error('[background-sync] stop failed:', err);
  }
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const { ignored } = await BackgroundSync.isIgnoringBatteryOptimizations();
    return ignored;
  } catch {
    return false;
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (!isNativePlatform()) return;
  await BackgroundSync.requestIgnoreBatteryOptimizations();
}

export async function openAutostartSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  await BackgroundSync.openAutostartSettings();
}

export async function openBackgroundLocationSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  await BackgroundSync.openAppSettings();
}

async function hasBackgroundLocationPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const perm = await Geolocation.checkPermissions();
    return perm.location === 'granted' || perm.coarseLocation === 'granted';
  } catch {
    return false;
  }
}

async function runSyncTick(userId: string): Promise<void> {
  await Promise.all([
    syncPhoneUsageToday(userId, false, { silent: true }),
    syncLocationNow(userId, false),
  ]);
}

export function initBackgroundSync(userId: string): () => void {
  if (!isNativePlatform() || !userId) return () => {};

  if (teardown && activeUserId === userId) return teardown;

  teardown?.();
  activeUserId = userId;

  const tickListener = BackgroundSync.addListener('syncTick', () => {
    if (activeUserId) {
      void runSyncTick(activeUserId);
    }
  });

  void refreshBackgroundSyncRunning().then(async (running) => {
    if (!running && isBackgroundSyncEnabled()) {
      await startBackgroundSync();
    }
  });

  const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && activeUserId && isBackgroundSyncEnabled()) {
      void refreshBackgroundSyncRunning().then((running) => {
        if (!running) void startBackgroundSync();
      });
    }
  });

  teardown = () => {
    void tickListener.then((h) => h.remove());
    void resumeListener.then((h) => h.remove());
    if (activeUserId === userId) {
      activeUserId = null;
      teardown = null;
    }
  };

  return teardown;
}
