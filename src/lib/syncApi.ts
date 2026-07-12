import { supabase } from './supabase';
import { NETWORK_TIMEOUT_MS } from './constants';

/** Shared raw edge-function call for sync actions — was reimplemented independently
 *  in DesktopDashboard.syncAll and useDailyStrainRefresh.refresh (same auth-token
 *  extraction + fetch + timeout + error-shape logic, copy-pasted twice). */
async function callEdgeFunction(fn: string, body: Record<string, unknown> = {}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${fn} failed: ${res.statusText || res.status}`);
  }
}

export function syncOura(userId: string): Promise<void> {
  return callEdgeFunction('sync', { service: 'oura', userId });
}

export function syncStrava(): Promise<void> {
  return callEdgeFunction('sync', { service: 'strava' });
}

export function syncCalendar(userId: string): Promise<void> {
  return callEdgeFunction('sync', { service: 'calendar', userId });
}

export function computeDailyStrain(userId: string, days = 2): Promise<void> {
  return callEdgeFunction('vanguard-nightly?action=compute-daily-strain', { userId, days });
}
