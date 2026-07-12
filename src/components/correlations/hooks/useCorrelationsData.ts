import { useMemo, useState } from 'react';
import type { CorrelationCategory, CorrelationResult } from '@vanguard/domain';
import { isInterestingCorrelationClient, isSleepStageDriver } from '@vanguard/domain';
import { useUserId } from '../../../store/useStore';
import { useCorrelationsQuery } from '../../../lib/correlationsApi';

const COVERAGE_HINTS: Record<string, string> = {
  caffeine_mg: 'Loguj kawę z godziną (logged_at)',
  last_coffee_hour: 'Kawa z timestampem w posiłkach',
  last_meal_hour: 'Posiłki z timestampem',
  late_caffeine: 'Kawa po 14:00 — timestamp w posiłku',
  workout_hr_peak: 'Treningi z HR (Oura sync + rescore)',
  run_hr_avg: 'Biegi Strava z pulsem',
  deep_sleep_h: 'Loguj kawę z godziną (logged_at)',
  rem_sleep_h: 'Sync Oura enhanced — fazy snu',
  sleep_efficiency: 'Sync Oura enhanced',
  bedtime_hour: 'Oura — godzina pójścia spać',
  supplement_creatine: 'Log suplementów (creatyna)',
  supplement_omega3: 'Log suplementów (omega-3)',
  phone_active_hours: 'ActivityWatch sync',
  productivity_ratio: 'ActivityWatch — stosunek produktywności',
  habit_count: 'Codzienne nawyki w app',
  food_quality: 'Ocena jakości posiłków',
  insulin_load: 'Insulin load z logów posiłków',
};

function scorePair(c: CorrelationResult) {
  return c.r_abs * 100 + (c.significant ? 40 : 0) + Math.min(c.n, 30) * 0.5 + (c.cross_domain ? 18 : 0);
}

export function useCorrelationsData() {
  const userId = useUserId();
  const [filter, setFilter] = useState<CorrelationCategory | 'all'>('all');
  const [includeWeak, setIncludeWeak] = useState(false);

  const query = useCorrelationsQuery(userId, includeWeak);
  const correlations = useMemo(() => query.data?.correlations ?? [], [query.data]);
  const behaviors = query.data?.behaviors ?? [];
  const coverage = useMemo(() => query.data?.coverage ?? {}, [query.data]);
  const stats = query.data?.stats ?? null;
  const loading = query.isLoading;
  const error = query.error
    ? (query.error instanceof Error ? query.error.message : 'Błąd ładowania korelacji')
    : null;
  const load = query.refetch;

  const visibleCorrelations = useMemo(() => {
    if (includeWeak) return correlations;
    return correlations.filter(isInterestingCorrelationClient);
  }, [correlations, includeWeak]);

  const filtered = useMemo(() => {
    let list = visibleCorrelations;
    if (filter !== 'all') list = list.filter(c => c.category === filter);
    return list;
  }, [visibleCorrelations, filter]);

  const highlights = useMemo(
    () => visibleCorrelations.filter(c => c.significant && c.has_enough_data).slice(0, 3),
    [visibleCorrelations]
  );

  const deepSleepDrivers = useMemo(
    () => visibleCorrelations
      .filter(c => c.y_metric === 'deep_sleep_h')
      .sort((a, b) => scorePair(b) - scorePair(a))
      .slice(0, 6),
    [visibleCorrelations],
  );

  const remSleepDrivers = useMemo(
    () => visibleCorrelations
      .filter(c => c.y_metric === 'rem_sleep_h')
      .sort((a, b) => scorePair(b) - scorePair(a))
      .slice(0, 6),
    [visibleCorrelations],
  );

  const filteredWithoutSleepStages = useMemo(() => {
    if (filter !== 'all' && filter !== 'sen') return filtered;
    return filtered.filter(c => !isSleepStageDriver(c));
  }, [filtered, filter]);

  const sparseMetrics = useMemo(() =>
    Object.entries(coverage)
      .filter(([k, n]) => n > 0 && n < 7 && COVERAGE_HINTS[k])
      .map(([k, n]) => ({ key: k, n, hint: COVERAGE_HINTS[k] })),
  [coverage]);

  return {
    userId,
    correlations,
    behaviors,
    coverage,
    stats,
    loading,
    error,
    filter, setFilter,
    includeWeak, setIncludeWeak,
    load,
    visibleCorrelations,
    filtered,
    highlights,
    deepSleepDrivers,
    remSleepDrivers,
    filteredWithoutSleepStages,
    sparseMetrics,
  };
}
