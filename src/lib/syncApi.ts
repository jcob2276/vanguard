import { invokeEdge } from './supabase';
import { NETWORK_TIMEOUT_MS } from './constants';

/** Shared raw edge-function call for sync actions — was reimplemented independently
 *  in DesktopDashboard.syncAll and useDailyStrainRefresh.refresh (same auth-token
 *  extraction + fetch + timeout + error-shape logic, copy-pasted twice). */
async function callEdgeFunction(fn: string, body: Record<string, unknown> = {}): Promise<void> {
  await invokeEdge(fn, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
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
