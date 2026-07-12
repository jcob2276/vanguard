import { useCallback, useEffect } from 'react';
import { notify } from '../lib/notify';
import { NETWORK_TIMEOUT_MS } from '../lib/constants';

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
  accessToken,
  onRefresh,
  setSyncing,
}: {
  userId: string | undefined;
  accessToken: string | undefined;
  onRefresh: () => void;
  setSyncing: (v: boolean) => void;
}) {
  const base = import.meta.env.VITE_SUPABASE_URL as string;

  const callFn = useCallback(async (fn: string, body: Record<string, unknown> = {}) => {
    const res = await fetch(`${base}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      throw new Error(`${fn} failed: ${p.error || res.status}`);
    }
  }, [base, accessToken]);

  const syncCalendar = useCallback(async () => {
    setSyncing(true);
    try {
      await callFn('sync?service=calendar', { userId });
      onRefresh();
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
    } finally {
      setSyncing(false);
    }
  }, [callFn, userId, onRefresh, setSyncing]);

  const handleGoogleCallback = useCallback(async (code: string) => {
    setSyncing(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const response = await fetch(`${base}/functions/v1/sync?service=calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId, code, redirectUri: window.location.origin }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      const res = await response.json();
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
  }, [base, accessToken, userId, syncCalendar, setSyncing]);

  // Delegate to the standalone exported startGoogleAuth — avoids duplicating OAuth redirect logic.
  // Wrapped in useCallback to maintain a stable reference for callers using it as a prop.
  const startGoogleAuthCb = useCallback(() => startGoogleAuth(), []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && userId) handleGoogleCallback(code);
  }, [handleGoogleCallback, userId]);

  return { syncCalendar, startGoogleAuth: startGoogleAuthCb };
}
