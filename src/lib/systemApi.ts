import { supabase } from './supabase';

export interface AuditEvent {
  id: string;
  created_at: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string | null;
  related_table: string | null;
  related_id: string | null;
  metadata: Record<string, unknown>;
}

export interface DataCoverage {
  oura_30: number;
  oura_90: number;
  nutrition_30: number;
  nutrition_90: number;
  wins_30: number;
  wins_90: number;
  overall_30: number;
  overall_90: number;
}

export interface PredictionCalibrationItem {
  date: string;
  sleep_error: number | null;
  readiness_error: number | null;
  execution_error: number | null;
}

export interface PredictionCalibrationSummary {
  sleep_mae: number | null;
  readiness_mae: number | null;
  execution_mae: number | null;
  total_resolved: number;
}

export interface SystemHealthData {
  events: AuditEvent[];
  coverage: DataCoverage | null;
  calibrationSummary: PredictionCalibrationSummary;
  calibrationHistory: PredictionCalibrationItem[];
}

export async function fetchSystemHealthData(userId: string): Promise<SystemHealthData> {
  const [logsRes, covRes, predRes] = await Promise.all([
    supabase
      .from('audit_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.rpc('get_data_coverage', { p_user_id: userId }),
    supabase
      .from('vanguard_predictions')
      .select('prediction_date, metric, error_value')
      .eq('user_id', userId)
      .eq('status', 'resolved')
      .eq('prediction_type', 'metric')
      .order('prediction_date', { ascending: true })
  ]);

  if (logsRes.error) throw logsRes.error;
  
  let coverage: DataCoverage | null = null;
  if (!covRes.error) {
    coverage = covRes.data as unknown as DataCoverage;
  } else {
    console.error('[Coverage Error API]', covRes.error);
  }

  // Calculate prediction calibration stats
  const itemsByDate: Record<string, PredictionCalibrationItem> = {};
  let sleepErrorSum = 0, sleepCount = 0;
  let readinessErrorSum = 0, readinessCount = 0;
  let executionErrorSum = 0, executionCount = 0;

  const predData = predRes.data || [];
  for (const row of predData) {
    const date = row.prediction_date;
    if (!itemsByDate[date]) {
      itemsByDate[date] = {
        date,
        sleep_error: null,
        readiness_error: null,
        execution_error: null
      };
    }
    const err = row.error_value;
    if (err != null) {
      if (row.metric === 'sleep_hours') {
        itemsByDate[date].sleep_error = err;
        sleepErrorSum += err;
        sleepCount++;
      } else if (row.metric === 'readiness_score') {
        itemsByDate[date].readiness_error = err;
        readinessErrorSum += err;
        readinessCount++;
      } else if (row.metric === 'execution_score') {
        // Multiply by 100 to show as percentage error (0-100)
        itemsByDate[date].execution_error = err * 100;
        executionErrorSum += err * 100;
        executionCount++;
      }
    }
  }

  const calibrationHistory = Object.keys(itemsByDate)
    .sort()
    .map(d => itemsByDate[d]);

  const calibrationSummary: PredictionCalibrationSummary = {
    sleep_mae: sleepCount > 0 ? parseFloat((sleepErrorSum / sleepCount).toFixed(2)) : null,
    readiness_mae: readinessCount > 0 ? parseFloat((readinessErrorSum / readinessCount).toFixed(2)) : null,
    execution_mae: executionCount > 0 ? parseFloat((executionErrorSum / executionCount).toFixed(1)) : null,
    total_resolved: predData.length
  };

  return {
    events: (logsRes.data as AuditEvent[]) || [],
    coverage,
    calibrationSummary,
    calibrationHistory
  };
}
