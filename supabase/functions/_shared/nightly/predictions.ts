import { createServiceClient } from '../supabase.ts';
import { getAggregateByDate } from '../repos/aggregatesRepo.ts';

/**
 * Generuje prognozę na jutro dla kluczowych metryk (sen, gotowość, wykonanie zadań).
 * Używa prostej średniej ważonej z ostatnich 7 dni.
 */
export async function generateTomorrowPredictions(
  supabase: any,
  userId: string,
  todayStr: string
): Promise<void> {
  const tomorrow = new Date(todayStr + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Pobierz ostatnie 7 dni historii (do dzisiaj włącznie)
  const { data: history, error } = await supabase
    .from('vanguard_daily_aggregates')
    .select('date, sleep_hours, readiness_score, execution_score')
    .eq('user_id', userId)
    .lte('date', todayStr)
    .order('date', { ascending: false })
    .limit(7);

  if (error) {
    console.error('[predictions] Fetching history failed:', error.message);
    return;
  }

  const metrics = ['sleep_hours', 'readiness_score', 'execution_score'] as const;
  const defaultValues = {
    sleep_hours: 7.5,
    readiness_score: 75.0,
    execution_score: 0.65
  };

  const margins = {
    sleep_hours: 1.2,
    readiness_score: 10.0,
    execution_score: 0.15
  };

  for (const metric of metrics) {
    let predictedValue = defaultValues[metric];
    
    // Oblicz średnią ważoną
    if (history && history.length > 0) {
      let sumValues = 0;
      let sumWeights = 0;
      history.forEach((row: any, idx: number) => {
        const val = row[metric];
        if (val != null) {
          // Im świeższy dzień, tym większa waga (od 7 dla wczoraj/dzisiaj do 1 dla najstarszego)
          const weight = 7 - idx;
          sumValues += val * weight;
          sumWeights += weight;
        }
      });
      if (sumWeights > 0) {
        predictedValue = parseFloat((sumValues / sumWeights).toFixed(2));
      }
    }

    const margin = margins[metric];
    const predicted_interval_low = Math.max(0, predictedValue - margin);
    const predicted_interval_high = predictedValue + margin;

    const { error: upsertErr } = await supabase
      .from('vanguard_predictions')
      .upsert({
        user_id: userId,
        prediction_date: tomorrowStr,
        prediction_type: 'metric',
        metric,
        predicted_value: predictedValue,
        predicted_interval_low,
        predicted_interval_high,
        status: 'pending',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,prediction_date,prediction_type,metric'
      });

    if (upsertErr) {
      console.error(`[predictions] Upsert failed for ${metric}:`, upsertErr.message);
    } else {
      console.log(`[predictions] Generated prediction for tomorrow (${tomorrowStr}) - ${metric}: ${predictedValue}`);
    }
  }
}

/**
 * Rozlicza zaległe prognozy metryk (do wczoraj włącznie) na podstawie rzeczywistych danych.
 */
export async function resolvePastPredictions(
  supabase: any,
  userId: string,
  todayStr: string
): Promise<void> {
  const yesterday = new Date(todayStr + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: pending, error: pendingErr } = await supabase
    .from('vanguard_predictions')
    .select('id, prediction_date, metric, predicted_value')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('prediction_type', 'metric')
    .lte('prediction_date', yesterdayStr);

  if (pendingErr) {
    console.error('[predictions] Fetching pending predictions failed:', pendingErr.message);
    return;
  }

  if (!pending || pending.length === 0) {
    console.log('[predictions] No pending metric predictions to resolve.');
    return;
  }

  for (const pred of pending) {
    let actualRow: Record<string, unknown> | null = null;
    try {
      actualRow = await getAggregateByDate(supabase, userId, pred.prediction_date);
    } catch (actualErr) {
      console.error(`[predictions] Fetching actual for ${pred.prediction_date} failed:`, actualErr);
      continue;
    }

    if (actualRow && actualRow[pred.metric] != null) {
      const actualValue = Number(actualRow[pred.metric]);
      const errorValue = Math.abs(pred.predicted_value - actualValue);

      const { error: updateErr } = await supabase
        .from('vanguard_predictions')
        .update({
          actual_value: actualValue,
          error_value: errorValue,
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', pred.id);

      if (updateErr) {
        console.error(`[predictions] Resolving prediction ${pred.id} failed:`, updateErr.message);
      } else {
        console.log(`[predictions] Resolved prediction ${pred.id} (${pred.metric} for ${pred.prediction_date}): predicted=${pred.predicted_value}, actual=${actualValue}, error=${errorValue}`);
      }
    }
  }
}
