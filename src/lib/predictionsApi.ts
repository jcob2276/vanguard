import { supabase } from './supabase';
import { shiftDateStr } from './date';

export interface Prediction {
  id: string;
  user_id: string;
  prediction_date: string;
  predicted_at: string;
  prediction_type: 'metric' | 'pattern' | 'custom';
  metric: string;
  predicted_value: number;
  predicted_interval_low: number | null;
  predicted_interval_high: number | null;
  actual_value: number | null;
  error_value: number | null;
  status: 'pending' | 'resolved';
}

/**
 * Pobiera wszystkie prognozy dla wybranego tygodnia.
 */
export async function listWeeklyPredictions(
  userId: string,
  weekStart: string
): Promise<Prediction[]> {
  const start = new Date(weekStart + 'T12:00:00Z');
  const weekEnd = shiftDateStr(weekStart, 6);

  const { data, error } = await supabase
    .from('vanguard_predictions')
    .select('*')
    .eq('user_id', userId)
    .gte('prediction_date', weekStart)
    .lte('prediction_date', weekEnd)
    .order('prediction_date', { ascending: true });

  if (error) {
    console.error('[predictionsApi] listWeeklyPredictions failed:', error.message);
    throw new Error(error.message);
  }

  return (data as Prediction[]) || [];
}

/**
 * Rozstrzyga ręcznie własną prognozę użytkownika.
 */
export async function resolveCustomPrediction(
  predictionId: string,
  actualValue: number
): Promise<void> {
  // Dla prognozy binarnej (custom) liczymy Brier Score: (predicted - actual)^2
  const { data: pred, error: selectErr } = await supabase
    .from('vanguard_predictions')
    .select('predicted_value')
    .eq('id', predictionId)
    .single();

  if (selectErr) {
    console.error('[predictionsApi] fetch prediction for resolution failed:', selectErr.message);
    throw new Error(selectErr.message);
  }

  const brierScore = Math.pow((pred?.predicted_value || 0) - actualValue, 2);

  const { error } = await supabase
    .from('vanguard_predictions')
    .update({
      actual_value: actualValue,
      error_value: brierScore,
      status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', predictionId);

  if (error) {
    console.error('[predictionsApi] resolveCustomPrediction failed:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Tworzy nową własną prognozę użytkownika (np. na nadchodzący tydzień).
 */
export async function createCustomPrediction(
  userId: string,
  predictionDate: string,
  metric: string,
  predictedValue: number
): Promise<void> {
  const { error } = await supabase.from('vanguard_predictions').insert({
    user_id: userId,
    prediction_date: predictionDate,
    prediction_type: 'custom',
    metric,
    predicted_value: predictedValue,
    status: 'pending',
  });

  if (error) {
    console.error('[predictionsApi] createCustomPrediction failed:', error.message);
    throw new Error(error.message);
  }
}
