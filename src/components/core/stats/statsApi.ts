import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { TIMEOUTS } from '../../../lib/constants';
import type { TrainingAnalysis } from './TrainingAnalysisSection';

export async function analyzeFoodQuality({ supabase, supabaseUrl, userId, analyzeDate, analyzePeriod }: { supabase: SupabaseClient<Database>; supabaseUrl: string; userId: string; analyzeDate: string; analyzePeriod: number }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) throw new Error('No active session found');
  const body = analyzePeriod === 1
    ? { userId, date: analyzeDate }
    : (() => {
        const to = getTodayWarsaw();
        const from = shiftDateStr(getTodayWarsaw(), -(analyzePeriod - 1));
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
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err: unknown) {
    console.error('analyzeFoodQuality error:', err);
    throw err;
  }
}

export async function analyzeTrainingLoad({ supabase, supabaseUrl, userId, from, to }: { supabase: SupabaseClient<Database>; supabaseUrl: string; userId: string; from: string; to: string }): Promise<TrainingAnalysis> {
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
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err: unknown) {
    console.error('analyzeTrainingLoad error:', err);
    throw err;
  }
}
