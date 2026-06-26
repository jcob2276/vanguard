import { useCallback, useEffect } from 'react';
import { notify } from '../lib/notify';

const GOOGLE_CLIENT_ID = '111163364613-nqd67ulputbk8ehbusls071g0ae4k2om.apps.googleusercontent.com';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

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
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      throw new Error(`${fn} failed: ${p.error || res.status}`);
    }
  }, [base, accessToken]);

  const syncCalendar = useCallback(async () => {
    setSyncing(true);
    try {
      await callFn('sync-calendar', { userId });
      onRefresh();
    } catch (err) {
      console.error('Calendar Sync Error:', err);
    } finally {
      setSyncing(false);
    }
  }, [callFn, userId, onRefresh, setSyncing]);

  const handleGoogleCallback = useCallback(async (code: string) => {
    setSyncing(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const response = await fetch(`${base}/functions/v1/sync-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId, code, redirectUri: window.location.origin }),
        signal: AbortSignal.timeout(15000),
      });
      const res = await response.json();
      if (res?.success) {
        await syncCalendar();
      } else {
        console.error('Google Auth Error:', res?.error);
        notify('Błąd połączenia z Google: ' + (res?.error || 'Nieznany błąd'), 'error');
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      notify('Błąd połączenia z Google: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [base, accessToken, userId, syncCalendar, setSyncing]);

  const startGoogleAuth = useCallback(() => {
    const options: Record<string, string> = {
      redirect_uri: window.location.origin,
      client_id: GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: GOOGLE_CALENDAR_SCOPE,
    };
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(options).toString()}`);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && userId) handleGoogleCallback(code);
  }, [handleGoogleCallback, userId]);

  return { syncCalendar, startGoogleAuth };
}
