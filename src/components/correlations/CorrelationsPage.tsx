import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, BarChart2, Coffee, Moon, Dumbbell,
  Brain, Activity, Info, Pill, Smartphone,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type {
  BehaviorEffectResult,
  CorrelationCategory,
  CorrelationResult,
  CorrelationStats,
} from '@vanguard/domain';
import { CATEGORY_LABELS, isInterestingCorrelationClient, isSleepStageDriver } from '@vanguard/domain';
import CorrelationCard from './CorrelationCard';
import BehaviorEffectCard from './BehaviorEffectCard';

const FILTERS: { id: CorrelationCategory | 'all'; icon: typeof Moon; label: string }[] = [
  { id: 'all', icon: BarChart2, label: 'Wszystkie' },
  { id: 'zywienie', icon: Coffee, label: 'Jedzenie' },
  { id: 'sen', icon: Moon, label: 'Sen' },
  { id: 'trening', icon: Dumbbell, label: 'Trening' },
  { id: 'regeneracja', icon: Activity, label: 'Regeneracja' },
  { id: 'zachowanie', icon: Brain, label: 'Zachowanie' },
  { id: 'suplementy', icon: Pill, label: 'Suplementy' },
  { id: 'ekran', icon: Smartphone, label: 'Ekran' },
];

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

export default function CorrelationsPage({ session }: { session: Session }) {
  const userId = session.user.id;
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [behaviors, setBehaviors] = useState<BehaviorEffectResult[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<CorrelationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CorrelationCategory | 'all'>('all');
  const [includeWeak, setIncludeWeak] = useState(false);

  const load = useCallback(async () => {
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

  const scorePair = (c: CorrelationResult) =>
    c.r_abs * 100 + (c.significant ? 40 : 0) + Math.min(c.n, 30) * 0.5 + (c.cross_domain ? 18 : 0);

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

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <header className="sticky top-0 z-30 w-full border-b border-border-custom bg-background/95 backdrop-blur-md">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            to="/"
            className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-black tracking-tight text-text-primary">
              Korelacje
            </h1>
            <p className="text-[10px] text-text-muted truncate">
              Skan odkrywczy · 90 dni · obserwacje, nie diagnozy
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-border-custom p-2.5 text-primary hover:bg-primary/5 disabled:opacity-40"
            title="Odśwież"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {/* Epistemic guardrail */}
        <div className="rounded-[18px] border border-primary/15 bg-primary/[0.03] px-4 py-3 flex gap-3">
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            To warstwa pomiarowa: system skanuje wszystkie metryki z logów (≥5 dni danych) i pokazuje pary,
            gdzie współwystępowanie jest czytelne — także te, których byś nie sprawdził ręcznie. N ≠ przyczyna.
          </p>
        </div>

        {!loading && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Pary', value: stats.total_pairs },
              { label: 'Istotne', value: stats.significant },
              { label: 'Cross-domain', value: stats.cross_domain ?? 0 },
              { label: 'Metryki', value: stats.metrics_tracked },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border-custom bg-surface px-3 py-2.5 text-center">
                <p className="text-[18px] font-black tabular-nums text-text-primary">{s.value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && stats && stats.hidden_weak != null && stats.hidden_weak > 0 && !includeWeak && (
          <p className="text-[10px] text-text-muted -mt-3">
            Ukryto {stats.hidden_weak} słabszych par (|r|&lt;0.28 lub za małe N). Włącz poniżej, żeby zobaczyć resztę.
          </p>
        )}

        {!loading && stats && stats.spearman_primary > 0 && (
          <p className="text-[10px] text-text-muted -mt-3">
            {stats.spearman_primary} par używa Spearmana (ρ) — lepszy przy nieliniowych zależnościach (np. godzina kawy, dawki).
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-600">
            {error}
          </div>
        )}

        {loading && correlations.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-[20px] bg-surface animate-pulse border border-border-custom" />
            ))}
          </div>
        )}

        {!loading && sparseMetrics.length > 0 && (
          <section className="rounded-[18px] border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Zbieranie danych
            </p>
            <ul className="space-y-1">
              {sparseMetrics.map(m => (
                <li key={m.key} className="text-[11px] text-text-secondary">
                  <span className="font-semibold text-text-primary">{m.key}</span> — {m.n} dni · {m.hint}
                </li>
              ))}
            </ul>
          </section>
        )}

        {highlights.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
              Najsilniejsze obserwacje (p&lt;0.05, N≥10)
            </p>
            <div className="space-y-3">
              {highlights.map(h => (
                <CorrelationCard key={h.id} item={h} expanded />
              ))}
            </div>
          </section>
        )}

        {(filter === 'all' || filter === 'sen') && deepSleepDrivers.length > 0 && (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
                Co wpływa na sen głęboki (Oura)
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Wybrane z pełnego skanu — wszystko, co ma dane, vs deep sleep (Oura).
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {deepSleepDrivers.map(c => (
                <CorrelationCard key={c.id} item={c} />
              ))}
            </div>
          </section>
        )}

        {(filter === 'all' || filter === 'sen') && remSleepDrivers.length > 0 && (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-600 dark:text-violet-400">
                Co wpływa na sen REM (Oura)
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                To samo dla REM — pary, które wyszły ze skanu, nie z ręcznej listy hipotez.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {remSleepDrivers.map(c => (
                <CorrelationCard key={c.id} item={c} />
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface border border-border-custom text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon size={11} />
                {f.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-[11px] text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={includeWeak}
            onChange={(e) => setIncludeWeak(e.target.checked)}
            className="rounded border-border-custom"
          />
          Pokaż słabsze korelacje i zachowania (szum / kalibracja)
        </label>

        {/* Correlation grid */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
            {filter === 'all' ? 'Odkryte pary' : CATEGORY_LABELS[filter]} ({filteredWithoutSleepStages.length})
          </p>
          {filteredWithoutSleepStages.length === 0 ? (
            <p className="text-center text-[12px] text-text-muted py-8">
              {includeWeak
                ? 'Brak wyników w tej kategorii — loguj dane kilka dni z rzędu.'
                : 'Brak mocnych sygnałów w tej kategorii. Włącz słabsze korelacje albo loguj regularniej (kawa z godziną, Oura, treningi).'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredWithoutSleepStages.map(c => (
                <CorrelationCard key={c.id} item={c} />
              ))}
            </div>
          )}
        </section>

        {/* Behavior effects */}
        <section className="space-y-3 pt-4 border-t border-border-custom">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
              Zachowania vs recovery (behavior_log)
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              Alkohol, podróż, stres — tylko gdy efekt na recovery jest czytelny (p&lt;0.05 lub duży Cohen&apos;s d).
            </p>
          </div>
          {behaviors.length === 0 ? (
            <p className="text-[12px] text-text-muted py-4 text-center rounded-xl border border-dashed border-border-custom">
              Brak czytelnych efektów zachowań — loguj alkohol/stres/podróż albo włącz słabsze wyniki powyżej.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {behaviors.map(b => (
                <BehaviorEffectCard key={b.behavior_key} item={b} />
              ))}
            </div>
          )}
        </section>

        {/* Coverage footer */}
        <details className="rounded-xl border border-border-custom bg-surface/50 p-3">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-text-muted">
            Pokrycie danych (90 dni)
          </summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(coverage)
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <div key={k} className="text-[10px] flex justify-between gap-2 py-1 border-b border-border-custom/40">
                  <span className="text-text-muted truncate">{k}</span>
                  <span className="font-bold text-text-primary shrink-0">{n}d</span>
                </div>
              ))}
          </div>
        </details>
      </main>
    </div>
  );
}
