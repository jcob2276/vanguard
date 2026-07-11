import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  BehaviorEffectResult,
  CorrelationCategory,
  CorrelationResult,
  CorrelationStats,
} from '@vanguard/domain';
import { isInterestingCorrelationClient, isSleepStageDriver } from '@vanguard/domain';
import { useUserId } from '../../../store/useStore';

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
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [behaviors, setBehaviors] = useState<BehaviorEffectResult[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<CorrelationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CorrelationCategory | 'all'>('all');
  const [includeWeak, setIncludeWeak] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = { user_id: userId, include_weak: includeWeak };
      const [corrRes, behRes] = await Promise.all([
        supabase.functions.invoke('vanguard-nightly?action=compute-correlations', { body: payload }),
        supabase.functions.invoke('compute-behavior-effects', { body: payload }),
      ]);
      if (corrRes.error) throw corrRes.error;
      if (behRes.error) throw behRes.error;
      if (corrRes.data?.error) throw new Error(corrRes.data.error);
      if (behRes.data?.error) throw new Error(behRes.data.error);
      setCorrelations(corrRes.data?.results ?? []);
      setCoverage(corrRes.data?.coverage ?? {});
      setStats(corrRes.data?.stats ?? null);
      setBehaviors(behRes.data?.results ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? (e as Error).message : 'Błąd ładowania korelacji');
    } finally {
      setLoading(false);
    }
  }, [userId, includeWeak]);

  useEffect(() => { void (async () => { await load(); })(); }, [load]);

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
