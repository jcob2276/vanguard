import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { TIMEOUTS } from '../../../lib/constants';
import type { TrainingAnalysis } from './TrainingAnalysisSection';
import { invokeEdge } from '../../../lib/supabase';

export async function analyzeFoodQuality({ userId, analyzeDate, analyzePeriod }: { userId: string; analyzeDate: string; analyzePeriod: number }) {
  const body = analyzePeriod === 1
    ? { userId, date: analyzeDate }
    : (() => {
        const to = getTodayWarsaw();
        const from = shiftDateStr(getTodayWarsaw(), -(analyzePeriod - 1));
        return { userId, dateFrom: from, dateTo: to };
      })();

  try {
    return await invokeEdge('analyze-food-quality', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    });
  } catch (err: unknown) {
    console.error('analyzeFoodQuality error:', err);
    throw err;
  }
}

export async function analyzeTrainingLoad({ userId, from, to }: { userId: string; from: string; to: string }): Promise<TrainingAnalysis> {
  try {
    return await invokeEdge<TrainingAnalysis>('analyze-training-load', {
      method: 'POST',
      body: { userId, start_date: from, end_date: to },
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    });
  } catch (err: unknown) {
    console.error('analyzeTrainingLoad error:', err);
    throw err;
  }
}
