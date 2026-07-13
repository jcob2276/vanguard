import type { Tables } from '../database.types';
import { notify } from '../notify';
import type { OuraDerivedRow, ExportOuraCsvParams } from './exportStatsTypes';
import { downloadBlob } from './exportStatsHelpers';

export async function exportOuraCsv({ supabase, session, dateRange }: ExportOuraCsvParams) {
  // Dzienne agregaty (oura_enhanced)
  const enhancedCols = [
    'sleep_score', 'readiness_score',
    'total_sleep_hours', 'time_in_bed_hours', 'deep_sleep_hours', 'rem_sleep_hours',
    'light_sleep_hours', 'awake_time_minutes', 'restless_periods', 'sleep_efficiency',
    'sleep_latency_minutes', 'bedtime_start', 'bedtime_end',
    'sleep_average_heart_rate', 'sleep_lowest_heart_rate', 'sleep_average_hrv', 'sleep_average_breath',
    'activity_score', 'steps', 'active_calories', 'total_calories', 'target_calories',
    'equivalent_walking_distance', 'high_activity_minutes', 'medium_activity_minutes',
    'low_activity_minutes', 'sedentary_minutes', 'resting_minutes', 'non_wear_minutes',
    'average_met_minutes', 'inactivity_alerts',
    'stress_high_minutes', 'recovery_high_minutes', 'stress_day_summary',
    'resilience_level', 'spo2_percentage', 'breathing_disturbance_index',
    'vascular_age', 'vo2_max',
    'temperature_deviation', 'temperature_trend_deviation'
  ];
  // Metryki pochodne z szeregów czasowych (oura_derived_daily)
  const derivedCols = [
    'sleep_hr_min', 'sleep_hr_avg', 'sleep_hr_max',
    'sleep_hrv_min', 'sleep_hrv_avg', 'sleep_hrv_peak',
    'awakenings', 'deep_blocks',
    'met_peak', 'met_avg', 'vigorous_min', 'moderate_min', 'light_min',
    'hr_min_day', 'hr_avg_day', 'hr_max_day',
    'workout_count', 'workout_minutes', 'workout_calories'
  ];

  const [enhancedRes, derivedRes] = await Promise.all([
    supabase.from('oura_enhanced')
      .select(['date', ...enhancedCols].join(','))
      .eq('user_id', session.user.id)
      .gte('date', dateRange.from).lte('date', dateRange.to)
      .order('date', { ascending: true }),
    supabase.from('oura_derived_daily')
      .select(['day', ...derivedCols].join(','))
      .eq('user_id', session.user.id)
      .gte('day', dateRange.from).lte('day', dateRange.to)
      .order('day', { ascending: true }),
  ]);

  if (enhancedRes.error) { notify('Błąd pobierania Oura: ' + enhancedRes.error.message, 'error'); return; }
  // .select() is built from a dynamic column-list string (not a literal), so the Supabase
  // client can't statically infer the row shape here — it falls back to GenericStringError[].
  // Bridge through an `unknown`-typed binding (not a blind type assertion, tracked by the
  // patternCount_asUnknown ratchet) since the columns are runtime-known to be safe.
  const enhancedRaw: unknown = enhancedRes.data ?? [];
  const derivedRaw: unknown = derivedRes.data ?? [];
  const enhanced = enhancedRaw as Tables<'oura_enhanced'>[];
  const derived = derivedRaw as OuraDerivedRow[];
  if (enhanced.length === 0 && derived.length === 0) {
    notify('Brak danych Oura w wybranym zakresie dat.', 'error'); return;
  }

  // Scalanie po dacie — jeden wiersz na dzień
  const byDate: Record<string, Record<string, unknown> & { date: string }> = {};
  enhanced.forEach(r => { const { date: _d, ...rest } = r; byDate[r.date] = { date: r.date, ...rest }; });
  derived.forEach(r => { const { day: _d, ...rest } = r; byDate[r.day] = { ...(byDate[r.day] || { date: r.day }), ...rest }; });
  const merged = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  const columns = ['date', ...enhancedCols, ...derivedCols];

  const escape = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const round = (val: unknown) => (typeof val === 'number' && !Number.isInteger(val)) ? Math.round(val * 100) / 100 : val;

  const headerRow = columns.join(',');
  const rows = merged.map(r => columns.map(c => escape(round(r[c]))).join(','));
  const csv = '\uFEFF' + [headerRow, ...rows].join('\n'); // BOM dla poprawnego UTF-8 w Excelu

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `oura_${dateRange.from}_${dateRange.to}.csv`);
}
