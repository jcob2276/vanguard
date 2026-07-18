import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '../lib/notify';
import { NETWORK_TIMEOUT_MS } from '../lib/constants';
import { invokeEdge } from '../lib/supabase';
import { calendarKeys, biometricsKeys } from '../lib/queryKeys';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/**
 * Redirects the browser to Google OAuth consent screen.
 * Standalone so both useSyncActions and DesktopDashboard can use the same implementation.
 */
export function startGoogleAuth(): void {
  const options: Record<string, string> = {
    redirect_uri: window.location.origin,
    client_id: GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: GOOGLE_CALENDAR_SCOPE,
  };
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(options).toString()}`);
}

export function useSyncActions({
  userId,
  accessToken: _accessToken,
  onRefresh,
  setSyncing,
}: {
  userId: string | undefined;
  accessToken: string | undefined;
  onRefresh: () => void;
  setSyncing: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const callFn = useCallback(async (fn: string, body: Record<string, unknown> = {}) => {
    await invokeEdge(fn, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
  }, []);

  const syncCalendarSilent = useCallback(async () => {
    try {
      await Promise.all([
        callFn('sync?service=calendar', { userId }),
        callFn('sync?service=oura', { userId }),
        callFn('sync?service=strava', { userId }),
      ]);
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: calendarKeys.all });
        await queryClient.invalidateQueries({ queryKey: biometricsKeys.all });
      }
      onRefresh();
    } catch (err: unknown) {
      console.warn('[Auto Sync Error]', err);
    }
  }, [callFn, userId, onRefresh, queryClient]);

  useEffect(() => {
    if (!userId) return;
    const LAST_SYNC_KEY = 'vanguard_last_unified_sync_time';
    const now = Date.now();
    let lastSync = 0;
    try {
      const val = localStorage.getItem(LAST_SYNC_KEY);
      lastSync = val ? parseInt(val, 10) : 0;
    } catch { /* local storage can be unavailable */ }

    // Throttle to 10 minutes (600,000 ms)
    if (now - lastSync > 10 * 60 * 1000) {
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(now));
      } catch { /* local storage can be unavailable */ }
      void syncCalendarSilent();
    }
  }, [userId, syncCalendarSilent]);

  const syncCalendar = useCallback(async () => {
    setSyncing(true);
    notify('Pobieram dane: Google Calendar, Oura i Strava… 🔄', 'info');
    try {
      await Promise.all([
        callFn('sync?service=calendar', { userId }),
        callFn('sync?service=oura', { userId }),
        callFn('sync?service=strava', { userId }),
      ]);
      const LAST_SYNC_KEY = 'vanguard_last_unified_sync_time';
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      } catch { /* local storage can be unavailable */ }
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: calendarKeys.all });
        await queryClient.invalidateQueries({ queryKey: biometricsKeys.all });
      }
      onRefresh();
      notify('Synchronizacja zakończona pomyślnie! 🛌🏃🗓️', 'success');
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd podczas synchronizacji', 'error');
    } finally {
      setSyncing(false);
    }
  }, [callFn, userId, onRefresh, setSyncing, queryClient]);

  const handleGoogleCallback = useCallback(async (code: string) => {
    setSyncing(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const res = await invokeEdge(
        'sync?service=calendar',
        {
          method: 'POST',
          body: { userId, code, redirectUri: window.location.origin },
          signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        }
      ) as { success?: boolean; error?: string };
      if (res?.success) {
        await syncCalendar();
      } else {
        console.error('Google Auth Error:', res?.error);
        notify('Błąd połączenia z Google: ' + (res?.error || 'Nieznany błąd'), 'error');
      }
    } catch (err: unknown) {
      console.error('Google Auth Error:', err);
      notify('Błąd połączenia z Google: ' + (err as Error).message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [userId, syncCalendar, setSyncing]);

  // Delegate to the standalone exported startGoogleAuth — avoids duplicating OAuth redirect logic.
  // Wrapped in useCallback to maintain a stable reference for callers using it as a prop.
  const startGoogleAuthCb = useCallback(() => startGoogleAuth(), []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && userId) handleGoogleCallback(code);
  }, [handleGoogleCallback, userId]);

  return { syncCalendar, startGoogleAuth: startGoogleAuthCb };
}
