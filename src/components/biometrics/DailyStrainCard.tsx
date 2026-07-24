/**
 * @component DailyStrainCard
 * @role Karta dobowego strain/recovery (DZIŚ tab) — spina Header/MetricsRow/VitalsRow.
 * @composes DailyStrainHeader, DailyStrainMetricsRow, DailyStrainVitalsRow
 * @usedBy DashboardDzisTab (lazy)
 */
import { getTodayWarsaw } from '../../lib/date';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import { useHaptics } from '../../hooks/useHaptics';
import { useQueryClient } from '@tanstack/react-query';
import { useUserId } from '../../store/useStore';
import { useDailyStrainOura } from '../../lib/biometricsApi';
import { biometricsKeys } from '../../lib/queryKeys';
import { SIGNAL_PILL, STATUS_RING, STATUS_GLOW, type StrainComponents } from './dailyStrainCardStyles';
import { parseStrainComponents } from '../../lib/db-json-guards';
import { useDailyStrainRefresh } from './hooks/useDailyStrainRefresh';
import DailyStrainHeader from './DailyStrainHeader';
import DailyStrainMetricsRow from './DailyStrainMetricsRow';
import DailyStrainVitalsRow from './DailyStrainVitalsRow';

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
    console.debug('[DailyStrainCard] Data stale, running one-shot silent background sync');
    refresh(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbData?.row?.date]);

  if (!userId) return null;

  if (loading) return <div className="card p-4"><DataStateNotice tone="loading" title="Obciążenie dnia się liczy" detail="Ładuje ostatni wynik obciążenia i regeneracji." /></div>;
  if (queryError) return <div className="card border-danger/20 p-4"><DataStateNotice tone="warning" title="Obciążenie niedostępne" detail={`Nie mogę odczytać danych: ${queryError.message}`} /></div>;
  if (!dbData?.row) return <div className="card p-4"><DataStateNotice title="Brak danych obciążenia" detail="Uruchom sync Oura/Strava i przelicz strain." /></div>;

  const { row, oura, ouraYesterday, enhanced, enhancedYesterday } = dbData;
  const strainScore = row.strain_score ?? 0;
  const recoveryScore = row.recovery_score ?? 0;
  const strainTone = strainScore >= 15 ? 'text-warning dark:text-warning' : strainScore >= 8 ? 'text-text-primary' : 'text-text-secondary';
  const recovTone = recoveryScore >= 75 ? 'text-success dark:text-success' : recoveryScore >= 55 ? 'text-warning dark:text-warning' : 'text-danger dark:text-danger';
  const missingSignals = [
    row.strain_score == null ? 'strain niepoliczony' : null,
    row.recovery_score == null ? 'recovery bez danych Oura' : null,
  ].filter(Boolean);

  const statusKey = (row.daily_status || 'green') as keyof typeof STATUS_RING;
  const isStale = row.date !== getTodayWarsaw();
  const comp: StrainComponents = parseStrainComponents(row.components) ?? {};
  const {
    recovery_confidence: recConf,
    strain_confidence: strConf,
    sleep_debt_h: sleepDebtH,
    hrv_z: hrvZ,
    rhr_z: rhrZ,
    sleep_score_today: sleepScoreToday,
    sleep_z: sleepZ,
    fueling_score: fuelingScore,
    readiness_signals: readinessSignals,
    wellness_load: wellnessLoad,
    explanation: strainExplanation,
  } = comp;
  const readinessLevel = row.readiness_level;

  return (
    <div className={`animate-fadeIn relative overflow-hidden card ${STATUS_RING[statusKey] || STATUS_RING.green} p-3.5 space-y-3`}>
      <div className={`absolute right-0 top-0 h-16 w-16 blur-[var(--blur-3xl)] ${STATUS_GLOW[statusKey] || STATUS_GLOW.green}`} />

      <DailyStrainHeader
        isStale={isStale}
        date={row.date}
        refreshing={refreshing}
        onRefresh={() => refresh(false)}
        readinessLevel={readinessLevel}
        strConf={strConf}
        recConf={recConf}
      />

      {/* Explanation */}
      {strainExplanation && (
        <p className="text-xs text-text-secondary leading-relaxed relative z-[var(--z-raised)]">{strainExplanation}</p>
      )}

      {wellnessLoad != null && wellnessLoad > 0 && (
        <p className="text-2xs text-text-muted relative z-[var(--z-raised)]">
          Wellness (sauna / zimno): <span className="font-bold text-warning">{wellnessLoad}</span> pkt w strain
        </p>
      )}

      {/* Signal pills */}
      {readinessSignals && readinessSignals.length > 0 && (
        <div className="flex flex-wrap gap-1 relative z-[var(--z-raised)]">
          {readinessSignals.map((s) => (
            <span key={s.key} className={`inline-flex rounded-lg border px-1.5 py-0.5 text-2xs font-bold ${SIGNAL_PILL[s.flag] ?? SIGNAL_PILL.neutral}`}>
              {s.detail}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-border-custom/30 relative z-[var(--z-raised)]" />

      {/* Mini metrics row: Strain | Recovery | [Fueling] | [Sleep debt] */}
      <DailyStrainMetricsRow
        strainScore={strainScore}
        strainTone={strainTone}
        recoveryScore={recoveryScore}
        recovTone={recovTone}
        fuelingScore={fuelingScore}
        sleepDebtH={sleepDebtH}
      />

      {/* Oura vitals */}
      {oura && (
        <DailyStrainVitalsRow
          oura={oura}
          ouraYesterday={ouraYesterday}
          enhanced={enhanced}
          enhancedYesterday={enhancedYesterday}
          hrvZ={hrvZ}
          rhrZ={rhrZ}
          sleepZ={sleepZ}
          sleepScoreToday={sleepScoreToday}
        />
      )}

      {missingSignals.length > 0 && (
        <DataStateNotice title="Niepełne dane" detail={missingSignals.join(' | ')} />
      )}

      {/* Oura Health Hub Launcher Button */}
      <Link
        to="/oura"
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 px-4 text-xs font-bold text-primary border border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.08] transition-all active:scale-[0.98] relative z-[var(--z-raised)]"
      >
        <Sparkles size={14} className="text-primary animate-pulse" />
        Pełny wgląd w sen i biometrię →
      </Link>
    </div>
  );
}


