import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { biometricsKeys } from '../../../lib/queryKeys';
import { syncOura, syncStrava, computeDailyStrain } from '../../../lib/syncApi';

interface Haptics {
  light: () => void;
  success: () => void;
  error: () => void;
}

export function useDailyStrainRefresh(userId: string | undefined, queryClient: QueryClient, haptics: Haptics) {
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(silent = false) {
    if (refreshing || !userId) return;
    setRefreshing(true);
    if (!silent) haptics.light();
    try {
      // sync runs enhanced + timeseries internally — one call does all three
      await Promise.all([
        syncStrava().catch(err => console.warn('[DailyStrainCard] sync-strava failed:', err)),
        syncOura(userId).catch(err => console.warn('[DailyStrainCard] sync-oura failed:', err)),
      ]);

      await computeDailyStrain(userId, 2);

      await queryClient.invalidateQueries({ queryKey: biometricsKeys.dailyStrainOura(userId) });
      if (!silent) haptics.success();
    } catch (e: unknown) {
      console.error('DailyStrainCard refresh:', e);
      if (!silent) haptics.error();
    } finally {
      setRefreshing(false);
    }
  }

  return { refreshing, refresh };
}
