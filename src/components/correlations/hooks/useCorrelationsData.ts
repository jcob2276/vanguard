import { useMemo, useState } from 'react';
import type { CorrelationCategory } from '@vanguard/domain';
import { classifyImpactFactors } from '@vanguard/domain';
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

export function useCorrelationsData() {
  const userId = useUserId();
  const [filter, setFilter] = useState<CorrelationCategory | 'all'>('all');
  const [includeWeak, setIncludeWeak] = useState(false);

  const query = useCorrelationsQuery(userId, includeWeak);
  const correlations = useMemo(() => query.data?.correlations ?? [], [query.data]);
  const coverage = useMemo(() => query.data?.coverage ?? {}, [query.data]);
  const stats = query.data?.stats ?? null;
  const loading = query.isLoading;
  const error = query.error
    ? (query.error instanceof Error ? query.error.message : 'Błąd ładowania korelacji')
    : null;
  const load = query.refetch;

  // Run the strict statistical classification
  const impactFactors = useMemo(() => classifyImpactFactors(correlations), [correlations]);

  const filteredFactors = useMemo(() => {
    let list = impactFactors;
    if (filter !== 'all') {
      list = list.filter(f => f.category === filter);
    }
    return list;
  }, [impactFactors, filter]);

  // Surf top factors for UI sections
  const confirmedFactors = useMemo(
    () => impactFactors.filter(f => f.evidence_level === 'confirmed').slice(0, 3),
    [impactFactors]
  );

  const probableFactors = useMemo(
    () => impactFactors.filter(f => f.evidence_level === 'probable').slice(0, 3),
    [impactFactors]
  );

  const hypotheses = useMemo(
    () => impactFactors.filter(f => f.evidence_level === 'hypothesis').slice(0, 3),
    [impactFactors]
  );

  const noEvidenceFactors = useMemo(
    () => impactFactors.filter(f => f.evidence_level === 'no_evidence').slice(0, 5),
    [impactFactors]
  );

  const sparseMetrics = useMemo(() =>
    Object.entries(coverage)
      .filter(([k, n]) => n > 0 && n < 15 && COVERAGE_HINTS[k])
      .map(([k, n]) => ({ key: k, n, hint: COVERAGE_HINTS[k], needed: 25 - n })),
  [coverage]);

  return {
    userId,
    impactFactors,
    filteredFactors,
    confirmedFactors,
    probableFactors,
    hypotheses,
    noEvidenceFactors,
    coverage,
    stats,
    loading,
    error,
    filter,
    setFilter,
    includeWeak,
    setIncludeWeak,
    load,
    sparseMetrics,
  };
}
