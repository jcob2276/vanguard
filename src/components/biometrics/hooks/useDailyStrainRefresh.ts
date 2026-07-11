import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { NETWORK_TIMEOUT_MS } from '../../../lib/constants';
import { biometricsKeys } from '../../../lib/biometricsApi';

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
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;
      const call = async (fn: string, body: Record<string, unknown>) => {
        const response = await fetch(`${base}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(`${fn} failed: ${payload.error || response.statusText || response.status}`);
        }
        return response;
      };

      // sync runs enhanced + timeseries internally — one call does all three
      await Promise.all([
        call('sync', { service: 'strava' }).catch(err => console.warn('[DailyStrainCard] sync-strava failed:', err)),
        call('sync', { service: 'oura', userId: userId }).catch(err => console.warn('[DailyStrainCard] sync-oura failed:', err)),
      ]);

      await call('vanguard-nightly?action=compute-daily-strain', { userId: userId, days: 2 });

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
