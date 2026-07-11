import { getTodayWarsaw } from '../../lib/date';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Zap, Activity, Moon, Thermometer, Footprints, BarChart2 } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import { useHaptics } from '../../hooks/useHaptics';
import { useQueryClient } from '@tanstack/react-query';
import { useUserId } from '../../store/useStore';
import { useDailyStrainOura, biometricsKeys } from '../../lib/biometricsApi';
import { zToVitalColor, CONF_PILL, SIGNAL_PILL, CONF_LABEL, STATUS_RING, STATUS_GLOW, READINESS_MAP, type StrainComponents } from './dailyStrainCardStyles';
import { useDailyStrainRefresh } from './hooks/useDailyStrainRefresh';


export default function DailyStrainCard({
  refreshSignal = 0,
}: {
  refreshSignal?: number
}) {
  const userId = useUserId();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const { refreshing, refresh } = useDailyStrainRefresh(userId, queryClient, haptics);

  const { data: dbData, isLoading: loading, error: queryError } = useDailyStrainOura(userId!);

  // Force refetch on external refreshSignal
  useEffect(() => {
    if (!refreshSignal || !userId) return;
    queryClient.invalidateQueries({ queryKey: biometricsKeys.dailyStrainOura(userId) });
  }, [refreshSignal, queryClient, userId]);

  // Tama 3: Silently trigger background sync if data is stale (not today's date).
  // Guard: fires at most once per calendar day per browser to prevent sync storm on every open.
  const AUTO_SYNC_KEY = 'vanguard_strain_auto_synced';
  useEffect(() => {
    if (!dbData?.row || refreshing) return;
    if (dbData.row.date === getTodayWarsaw()) return; // data already current
    try {
      if (localStorage.getItem(AUTO_SYNC_KEY) === getTodayWarsaw()) return; // already synced today
      localStorage.setItem(AUTO_SYNC_KEY, getTodayWarsaw());
    } catch { /* ignore storage errors */ }
    console.log('[DailyStrainCard] Data stale, running one-shot silent background sync');
    refresh(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbData?.row?.date]);

  if (!userId) return null;

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

  if (queryError) {
    return (
      <div className="card border-red-500/20 p-4">
        <DataStateNotice
          tone="warning"
          title="Obciążenie niedostępne"
          detail={`Nie mogę odczytać danych: ${queryError.message}`}
        />
      </div>
    );
  }

  if (!dbData?.row) {
    return (
      <div className="card p-4">
        <DataStateNotice
          title="Brak danych obciążenia"
          detail="Uruchom sync Oura/Strava i przelicz strain."
        />
      </div>
    );
  }

  const { row, oura } = dbData;
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
  const comp = (row.components as unknown as StrainComponents) ?? {};
  const recConf         = comp.recovery_confidence;
  const strConf         = comp.strain_confidence;
  const caffeineMg      = comp.caffeine_active_mg;
  const sleepDebtH      = comp.sleep_debt_h;
  const hrvZ            = comp.hrv_z;
  const rhrZ            = comp.rhr_z;
  const sleepScoreToday = comp.sleep_score_today;
  const sleepZ          = comp.sleep_z;
  const fuelingScore      = comp.fueling_score;
  const readinessSignals = comp.readiness_signals;
  const wellnessLoad      = comp.wellness_load;
  const strainExplanation = comp.explanation;
  const readinessLevel  = row.readiness_level;
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
        <button onClick={() => refresh(false)} disabled={refreshing} title="Sync + przelicz"
          className="rounded-xl border border-border-custom bg-surface-solid/40 p-2 text-text-muted transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 disabled:opacity-50">
          <RefreshCw size={11} className={refreshing ? 'animate-spin text-primary' : ''} />
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
        to="/korelacje"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border-custom/40 bg-surface-solid/20 py-2 text-[10px] font-bold text-text-muted hover:text-primary hover:border-primary/20 transition-all active:scale-[0.985] relative z-10"
      >
        <BarChart2 size={11} />
        Korelacje — kawa, sen, trening
      </Link>
    </div>
  );
}
