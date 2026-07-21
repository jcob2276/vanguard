import { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { getWarsawDateString } from '@vanguard/domain';
import { notify } from '../../lib/notify';
import { fetchPhoneUsageDaily } from '../../lib/phoneUsageApi';
import {
  isBackgroundSyncEnabled,
  isIgnoringBatteryOptimizations,
  refreshBackgroundSyncRunning,
  startBackgroundSync,
  stopBackgroundSync,
} from '../../lib/native/backgroundSync';
import { consumeNativeShareOnResume } from '../../lib/native/initNativeIntents';
import {
  fetchTodayLocationSummary,
  hasLocationPermission,
  requestLocationPermission,
  syncLocationNow,
} from '../../lib/native/locationSync';
import { hasUsageStatsAccess, syncPhoneUsageToday } from '../../lib/native/usageStatsSync';

function syncErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'usage_access_denied':
      return 'Brak dostępu do statystyk — tapnij Uprawnienia i włącz Vanguard.';
    case 'location_denied':
      return 'Brak lokalizacji — zezwól w popupie Androida.';
    case 'not_authenticated':
      return 'Nie jesteś zalogowany — wyloguj i zaloguj ponownie.';
    default:
      return code ? `Sync nie powiódł się: ${code}` : 'Sync nie powiódł się.';
  }
}

export function useNativePermissionsCard(userId: string) {
  const [usageGranted, setUsageGranted] = useState<boolean | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [batteryIgnored, setBatteryIgnored] = useState<boolean | null>(null);
  const [bgSyncOn, setBgSyncOn] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastTotal, setLastTotal] = useState<number | null>(null);
  const [lastUnlocks, setLastUnlocks] = useState<number | null>(null);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [latestPlace, setLatestPlace] = useState<string | null>(null);

  const refreshAccess = useCallback(async () => {
    const [usage, location, battery, running] = await Promise.all([
      hasUsageStatsAccess(),
      hasLocationPermission(),
      isIgnoringBatteryOptimizations(),
      refreshBackgroundSyncRunning(),
    ]);
    setUsageGranted(usage);
    setLocationGranted(location);
    setBatteryIgnored(battery);
    setBgSyncOn(running || isBackgroundSyncEnabled());
    return { usage, location, battery, running };
  }, []);

  const refreshSnapshot = useCallback(async () => {
    try {
      const [phone, loc] = await Promise.all([
        fetchPhoneUsageDaily(userId, getWarsawDateString()),
        fetchTodayLocationSummary(userId),
      ]);
      setLastTotal(phone?.total_minutes ?? null);
      setLastUnlocks(phone?.unlocks ?? null);
      setLocationCount(loc.count);
      setLatestPlace(loc.latestPlace);
    } catch {
      setLastTotal(null);
      setLastUnlocks(null);
      setLocationCount(null);
      setLatestPlace(null);
    }
  }, [userId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- mount permission + snapshot probe */
    void refreshAccess();
    void refreshSnapshot();
    /* eslint-enable react-hooks/set-state-in-effect */

    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void refreshAccess();
        void refreshSnapshot();
        void consumeNativeShareOnResume();
      }
    });

    return () => {
      void sub.then((h) => h.remove());
    };
  }, [refreshAccess, refreshSnapshot]);

  const toggleBackgroundSync = async () => {
    if (bgSyncOn) {
      await stopBackgroundSync();
      setBgSyncOn(false);
      notify('Sync w tle wyłączony', 'info');
      return;
    }
    if (!usageGranted || !locationGranted) {
      notify('Najpierw włącz statystyki użycia i lokalizację.', 'error');
      return;
    }
    const started = await startBackgroundSync();
    setBgSyncOn(started);
    if (started) {
      notify('Sync w tle aktywny — powiadomienie na pasku', 'success');
    } else {
      notify('Nie udało się uruchomić sync w tle', 'error');
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      if (!locationGranted) {
        await requestLocationPermission();
        await refreshAccess();
      }

      const [phone, location] = await Promise.all([
        syncPhoneUsageToday(userId, true, { silent: true }),
        syncLocationNow(userId, true),
      ]);

      await refreshSnapshot();

      const parts: string[] = [];
      if (phone.ok) parts.push(`ekran ${phone.totalMinutes ?? '?'} min`);
      if (location.ok) {
        parts.push(location.placeName ? `📍 ${location.placeName}` : '📍 GPS zapisany');
      }
      if (parts.length > 0) {
        notify(`Zsynchronizowano: ${parts.join(' · ')}`, 'success');
        return;
      }
      if (phone.skipped && location.skipped) {
        notify('Dane aktualne (sync niedawno).', 'info');
        return;
      }
      notify(syncErrorMessage(phone.error ?? location.error), 'error');
    } finally {
      setSyncing(false);
    }
  };

  return {
    usageGranted,
    locationGranted,
    batteryIgnored,
    bgSyncOn,
    syncing,
    lastTotal,
    lastUnlocks,
    locationCount,
    latestPlace,
    toggleBackgroundSync,
    syncNow,
  };
}
