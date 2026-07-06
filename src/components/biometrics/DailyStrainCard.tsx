import { getTodayWarsaw } from '../../lib/date';
import { NETWORK_TIMEOUT_MS } from '../../lib/constants';
import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Zap, Activity, Moon, Thermometer, Footprints, BarChart2 } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import { useHaptics } from '../../hooks/useHaptics';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '../../lib/database.types';

const LIMITER_PL = {
  sleep: 'sen', calories: 'kalorie', carbs: 'węgle',
  cardio_load: 'koszt cardio', strength_load: 'siłownia',
  mental_load: 'głowa', recovery_ok: 'OK',
};

// VitalBands: color tile by z-score vs personal EWMA baseline (Strand VitalBands.swift)
// positive z = better than baseline; |z| ≤ 2 = in personal normal range
function zToVitalColor(z: number | null | undefined, defaultColor: string): string {
  if (z == null) return defaultColor;
  if (z >= 1.0)        return 'text-emerald-500 dark:text-emerald-400';
  if (z >= -1.0)       return defaultColor;
  if (z >= -2.0)       return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-500 dark:text-rose-400';
}

const CONF_PILL = {
  solid:       'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  building:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  calibrating: 'bg-surface-solid text-text-muted border border-border-custom',
};

const SIGNAL_PILL: Record<string, string> = {
  good:    'border-emerald-500/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400',
  neutral: 'border-border-custom bg-surface-solid text-text-muted',
  watch:   'border-amber-500/30 bg-amber-500/8 text-amber-600 dark:text-amber-400',
  bad:     'border-rose-500/30 bg-rose-500/8 text-rose-600 dark:text-rose-400',
};
const CONF_LABEL = { solid: 'Solid', building: 'Building', calibrating: 'Calibrating' };

const STATUS_RING = {
  green:  '!border-emerald-500/20',
  yellow: '!border-amber-500/20',
  red:    '!border-rose-500/25',
};
const STATUS_GLOW = { green: 'bg-emerald-500/5', yellow: 'bg-amber-500/5', red: 'bg-rose-500/5' };

const READINESS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  primed:       { label: '⚡ Gotowy do działania', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  balanced:     { label: '✓ Zbalansowany',          color: 'text-sky-600 dark:text-sky-400',         bg: 'bg-sky-500/10 border-sky-500/20' },
  strained:     { label: '⚠ Zmęczony',             color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-500/10 border-amber-500/20' },
  rundown:      { label: '↓ Wyczerpany',            color: 'text-rose-600 dark:text-rose-400',        bg: 'bg-rose-500/10 border-rose-500/20' },
  insufficient: { label: '– Za mało danych',        color: 'text-text-muted',                         bg: 'bg-surface-solid border-border-custom' },
};


export default function DailyStrainCard({
  session,
  refreshSignal = 0,
}: {
  session: Session
  refreshSignal?: number
}) {
  const haptics = useHaptics();
  const [row, setRow] = useState<Tables<'daily_strain'> | null>(null);
  const [oura, setOura] = useState<Tables<'oura_daily_summary'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRow = useCallback(async () => {
    const [{ data, error: queryError }, { data: ouraSummaries }] = await Promise.all([
      supabase.from('daily_strain')
        .select('*').eq('user_id', session.user.id)
        .order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('oura_daily_summary')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false }).limit(2),
    ]);
    if (queryError) {
      console.error('DailyStrainCard:', queryError);
      setError(queryError.message);
      setRow(null);
    } else {
      setRow(data);
    }
    if (ouraSummaries?.length) {
      const todayStr = getTodayWarsaw();
      setOura(ouraSummaries.find(s => s.date === todayStr) || ouraSummaries[0]);
    }
  }, [session.user.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await fetchRow();
      setLoading(false);
    })();
  }, [fetchRow]);

  // Light refresh after food/workout save; second pass picks up debounced compute-daily-strain.
  useEffect(() => {
    if (!refreshSignal) return;
    void fetchRow();
    const retry = window.setTimeout(() => void fetchRow(), 6500);
    return () => window.clearTimeout(retry);
  }, [refreshSignal, fetchRow]);

  // Pełny refresh: sync źródeł → warstwy pochodne Oura → przelicz strain → odśwież
  async function refresh() {
    setRefreshing(true);
    haptics.light();
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;
      const call = async (fn: string, body: any) => {
        const response = await fetch(`${base}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(`${fn} failed: ${payload.error || response.statusText || response.status}`);
        }
        return response;
      };
      // 1. źródła surowe (równolegle) - tolerujemy błędy pojedynczych synchronizatorów
      await Promise.all([
        call('sync-strava', {}).catch(err => console.warn('[DailyStrainCard] sync-strava failed:', err)),
        call('sync-oura', { userId: session.user.id }).catch(err => console.warn('[DailyStrainCard] sync-oura failed:', err)),
      ]);
      // 2. warstwy pochodne Oura (strefy HR zasilają cardio load)
      await Promise.all([
        call('sync-oura-enhanced', { userId: session.user.id, days: 2 }).catch(err => console.warn('[DailyStrainCard] sync-oura-enhanced failed:', err)),
        call('sync-oura-timeseries', { userId: session.user.id, days: 2 }).catch(err => console.warn('[DailyStrainCard] sync-oura-timeseries failed:', err)),
      ]);
      // 3. przelicz Daily Strain
      await call('compute-daily-strain', { userId: session.user.id, days: 2 });
      // 4. odśwież kartę
      await fetchRow();
      haptics.success();
    } catch (e: unknown) {
      console.error('DailyStrainCard refresh:', e);
      setError((e as Error).message || 'Refresh failed');
      haptics.error();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-4">
        <DataStateNotice
          tone="loading"
          title="Obciążenie dnia się liczy"
          detail="Ładuje ostatni wynik obciążenia i regeneracji."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-500/20 p-4">
        <DataStateNotice
          tone="warning"
          title="Obciążenie niedostępne"
          detail={`Nie mogę odczytać danych: ${error}`}
        />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="card p-4">
        <DataStateNotice
          title="Brak danych obciążenia"
          detail="Uruchom sync Oura/Strava i przelicz strain."
        />
      </div>
    );
  }

  const strainScore = row.strain_score ?? 0;
  const recoveryScore = row.recovery_score ?? 0;
  const strainTone = strainScore >= 15 ? 'text-orange-500 dark:text-orange-400' : strainScore >= 8 ? 'text-text-primary' : 'text-text-secondary';
  const recovTone = recoveryScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : recoveryScore >= 55 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const missingSignals = [
    row.strain_score == null ? 'strain niepoliczony' : null,
    row.recovery_score == null ? 'recovery bez danych Oura' : null,
  ].filter(Boolean);

  const statusKey = (row.daily_status || 'green') as keyof typeof STATUS_RING;
  const isStale = row.date !== getTodayWarsaw();

  const comp = (row.components as any) ?? {};
  const recConf         = comp.recovery_confidence as 'calibrating' | 'building' | 'solid' | undefined;
  const strConf         = comp.strain_confidence   as 'calibrating' | 'building' | 'solid' | undefined;
  const caffeineMg      = comp.caffeine_active_mg  as number  | null | undefined;
  const sleepDebtH      = comp.sleep_debt_h        as number  | null | undefined;
  const hrvZ            = comp.hrv_z               as number  | null | undefined;
  const rhrZ            = comp.rhr_z               as number  | null | undefined;
  const sleepScoreToday = comp.sleep_score_today   as number  | null | undefined;
  const sleepZ          = comp.sleep_z             as number  | null | undefined;
  const fuelingScore      = comp.fueling_score     as number  | null | undefined;
  const readinessSignals = comp.readiness_signals as Array<{ key: string; flag: string; detail: string }> | null | undefined;
  const wellnessLoad      = comp.wellness_load     as number  | null | undefined;
  const strainExplanation = comp.explanation       as string  | null | undefined;
  const readinessLevel  = (row as any).readiness_level as string | null | undefined;
  const readinessInfo   = readinessLevel ? READINESS_MAP[readinessLevel] : null;

  const metricCols = 2 + (fuelingScore != null ? 1 : 0) + (sleepDebtH != null ? 1 : 0);

  return (
    <div className={`animate-fadeIn relative overflow-hidden card ${STATUS_RING[statusKey] || STATUS_RING.green} p-3.5 space-y-3`}>
      <div className={`absolute right-0 top-0 h-16 w-16 blur-3xl ${STATUS_GLOW[statusKey] || STATUS_GLOW.green}`} />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="pixel-label text-[10px]">Stan gotowości</span>
          {isStale && (
            <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wider">
              (Dane z {row.date})
            </span>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing} title="Sync + przelicz"
          className="rounded-xl border border-border-custom bg-surface-solid/40 p-2 text-text-muted transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 disabled:opacity-50">
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Readiness badge + confidence pills on same row */}
      <div className="flex items-center gap-1.5 flex-wrap relative z-10">
        {readinessInfo && (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${readinessInfo.bg} ${readinessInfo.color}`}>
            {readinessInfo.label}
          </span>
        )}
        {strConf && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${CONF_PILL[strConf]}`}>
            Strain · {CONF_LABEL[strConf]}
          </span>
        )}
        {recConf && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${CONF_PILL[recConf]}`}>
            Recovery · {CONF_LABEL[recConf]}
          </span>
        )}
      </div>

      {/* Explanation */}
      {strainExplanation && (
        <p className="text-[11.5px] text-text-secondary leading-relaxed relative z-10">{strainExplanation}</p>
      )}

      {wellnessLoad != null && wellnessLoad > 0 && (
        <p className="text-[9.5px] text-text-muted relative z-10">
          Wellness (sauna / zimno): <span className="font-bold text-orange-500">{wellnessLoad}</span> pkt w strain
        </p>
      )}

      {/* Signal pills */}
      {readinessSignals && readinessSignals.length > 0 && (
        <div className="flex flex-wrap gap-1 relative z-10">
          {readinessSignals.map((s) => (
            <span key={s.key} className={`inline-flex rounded-lg border px-1.5 py-0.5 text-[8.5px] font-bold ${SIGNAL_PILL[s.flag] ?? SIGNAL_PILL.neutral}`}>
              {s.detail}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-border-custom/30 relative z-10" />

      {/* Mini metrics row: Strain | Recovery | [Fueling] | [Sleep debt] */}
      <div className={`grid gap-4 relative z-10`} style={{ gridTemplateColumns: `repeat(${metricCols}, 1fr)` }}>
        {/* Strain */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Strain</p>
          <p className={`text-[19px] font-black leading-none mt-0.5 ${strainTone}`}>
            {strainScore ?? '--'}<span className="text-[9px] text-text-muted font-normal">/21</span>
          </p>
          <div className="mt-1.5 h-[2px] bg-border-custom/40 rounded-full">
            <div className="h-[2px] rounded-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, (strainScore / 21) * 100)}%` }} />
          </div>
        </div>

        {/* Recovery */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Recovery</p>
          <p className={`text-[19px] font-black leading-none mt-0.5 ${recovTone}`}>
            {recoveryScore ?? '--'}<span className="text-[9px] text-text-muted font-normal">/100</span>
          </p>
          <div className="mt-1.5 h-[2px] bg-border-custom/40 rounded-full">
            <div className={`h-[2px] rounded-full transition-all ${recoveryScore >= 75 ? 'bg-emerald-500' : recoveryScore >= 55 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, recoveryScore)}%` }} />
          </div>
        </div>

        {/* Fueling */}
        {fuelingScore != null && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Fueling</p>
            <p className={`text-[19px] font-black leading-none mt-0.5 ${fuelingScore >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {fuelingScore}<span className="text-[9px] text-text-muted font-normal">/100</span>
            </p>
            <div className="mt-1.5 h-[2px] bg-border-custom/40 rounded-full">
              <div className={`h-[2px] rounded-full transition-all ${fuelingScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, fuelingScore)}%` }} />
            </div>
          </div>
        )}

        {/* Sleep debt */}
        {sleepDebtH != null && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
              {sleepDebtH < 0 ? 'Dług snu' : 'Nadwyżka'}
            </p>
            <p className={`text-[19px] font-black leading-none mt-0.5 ${sleepDebtH < -0.5 ? 'text-rose-500' : sleepDebtH > 0.5 ? 'text-emerald-500' : 'text-text-primary'}`}>
              {sleepDebtH < 0 ? `${Math.abs(sleepDebtH)}h` : sleepDebtH > 0 ? `+${sleepDebtH}h` : '–'}
            </p>
          </div>
        )}
      </div>

      {/* Oura vitals */}
      {oura && (
        <>
          <div className="h-px bg-border-custom/30 relative z-10" />
          <div className="flex items-center justify-between relative z-10">
            {[
              { icon: Zap,         label: 'HRV',   value: oura.hrv_avg ? `${oura.hrv_avg}ms` : '--',           color: zToVitalColor(hrvZ, 'text-dayA') },
              { icon: Activity,    label: 'RHR',   value: oura.rhr_avg ? `${oura.rhr_avg}bpm` : '--',          color: zToVitalColor(rhrZ, 'text-dayB') },
              { icon: Moon,        label: 'Sen',   value: sleepScoreToday != null ? `${sleepScoreToday}pts` : (oura.total_sleep_hours ? `${Math.floor(oura.total_sleep_hours)}h${Math.round((oura.total_sleep_hours % 1) * 60)}m` : '--'), color: zToVitalColor(sleepZ, oura.total_sleep_hours == null ? 'text-text-muted' : oura.total_sleep_hours >= 7.5 ? 'text-emerald-500 dark:text-emerald-400' : oura.total_sleep_hours >= 6 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400') },
              { icon: Thermometer, label: 'Temp',  value: oura.temp_deviation != null ? `${oura.temp_deviation > 0 ? '+' : ''}${oura.temp_deviation}°` : '--', color: Math.abs(oura.temp_deviation || 0) > 0.5 ? 'text-rose-500' : 'text-text-secondary' },
              { icon: Footprints,  label: 'Kroki', value: (oura.steps ?? 0) > 0 ? (oura.steps ?? 0).toLocaleString() : '--', color: 'text-dayC' },
            ].map(({ icon: Icon, label, value, color }, idx) => (
              <div key={label} className={`flex-1 flex flex-col items-center text-center ${idx > 0 ? 'border-l border-border-custom/30' : ''}`}>
                <div className="flex items-center gap-0.5">
                  <Icon size={9} className={color} />
                  <span className="text-[8px] font-bold tracking-wider text-text-muted uppercase">{label}</span>
                </div>
                <span className={`text-[10px] font-black font-mono mt-0.5 ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {missingSignals.length > 0 && (
        <DataStateNotice title="Niepełne dane" detail={missingSignals.join(' | ')} />
      )}

      {/* Correlations link */}
      <Link
        to="/korealcje"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border-custom/40 bg-surface-solid/20 py-2 text-[10px] font-bold text-text-muted hover:text-primary hover:border-primary/20 transition-all active:scale-[0.985] relative z-10"
      >
        <BarChart2 size={11} />
        Korelacje — kawa, sen, trening
      </Link>
    </div>
  );
}
