import { formatWarsawDate, getTodayWarsaw } from '../../../lib/date';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';

export async function syncYazioHistory({ supabase, supabaseUrl, userId, days = 25 }: { supabase: SupabaseClient<Database>; supabaseUrl: string; userId: string; days?: number }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) throw new Error('No active session found');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-yazio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`
      },
      body: JSON.stringify({ userId, sync_history: true, days }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('syncYazioHistory error:', err);
    throw err;
  }
}

export async function analyzeFoodQuality({ supabase, supabaseUrl, userId, analyzeDate, analyzePeriod }: { supabase: SupabaseClient<Database>; supabaseUrl: string; userId: string; analyzeDate: string; analyzePeriod: number }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) throw new Error('No active session found');
  const body = analyzePeriod === 1
    ? { userId, date: analyzeDate }
    : (() => {
        const to = getTodayWarsaw();
        const from = (() => { const d = new Date(getTodayWarsaw() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (analyzePeriod - 1)); return d.toISOString().split('T')[0] })();
        return { userId, dateFrom: from, dateTo: to };
      })();

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-food-quality`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('analyzeFoodQuality error:', err);
    throw err;
  }
}

export async function analyzeTrainingLoad({ supabase, supabaseUrl, userId, from, to }: { supabase: SupabaseClient<Database>; supabaseUrl: string; userId: string; from: string; to: string }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) throw new Error('No active session found');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-training-load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`
      },
      body: JSON.stringify({ userId, start_date: from, end_date: to }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('analyzeTrainingLoad error:', err);
    throw err;
  }
}
