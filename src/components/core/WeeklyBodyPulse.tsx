import { Activity, AlertCircle, CheckCircle2, Moon, Dumbbell, Flame } from 'lucide-react';
import { useWeeklyBodyPulse } from '../../lib/biometricsApi';
import { useUserId } from '../../store/useStore';
import { getTodayWarsaw } from '../../lib/date';
import { needsRecoveryCorrection } from '../../lib/horizonSignals';
import {
  bodyPulseHeadline,
  formatDurationHours,
  formatSleepDayLabel,
  type WeeklyBodyPulseData,
} from '../../lib/weeklyBodyPulse';
import Badge from '../ui/Badge';

export default function WeeklyBodyPulse() {
  const userId = useUserId();
  const { data, isLoading, isError } = useWeeklyBodyPulse(userId ?? '');
  if (!userId) return null;

  const today = getTodayWarsaw();
  const needsAttention = Boolean(data && (
    needsRecoveryCorrection(data)
    || (data.sleepAvgHours != null && data.sleepAvgHours < 6.5)
    || (data.gymCount === 0 && data.runCount === 0)
  ));

  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4.5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-text-muted">
            <Activity size={12} className="text-primary" /> Ciało · 7 dni
          </p>
          <h3 className="mt-1 text-base font-bold text-text-primary">
            {isLoading ? 'Ładuję przebieg…' : isError ? 'Brak pełnych danych ciała' : data ? bodyPulseHeadline(data) : 'Brak danych'}
          </h3>
        </div>
        {needsAttention ? (
          <Badge variant="tag" color="var(--color-warning)" className="shrink-0">
            <AlertCircle size={12} className="mr-1 inline" /> Wymaga uwagi
          </Badge>
        ) : (
          <Badge variant="tag" color="var(--color-success)" className="shrink-0">
            <CheckCircle2 size={12} className="mr-1 inline" /> W normie
          </Badge>
        )}
      </div>

      {/* Section 1: Workout & Activity Highlights */}
      <div className="rounded-2xl border border-border-custom/40 bg-surface/50 p-3">
        <p className="text-3xs font-black uppercase tracking-widest text-text-muted mb-2 flex items-center gap-1.5">
          <Dumbbell size={11} className="text-primary" /> Trening i aktywność
        </p>
        <div className="grid grid-cols-3 gap-2">
          <ActivityChip label="Siłownia" value={`${data?.gymCount ?? 0}`} active={Boolean(data && data.gymCount > 0)} />
          <ActivityChip label="Bieganie" value={formatRuns(data)} active={Boolean(data && data.runCount > 0)} />
          <ActivityChip label="Sauna" value={formatSauna(data)} active={Boolean(data && data.saunaCount > 0)} />
        </div>
      </div>

      {/* Section 2: Primary Sleep & HRV Hero Block */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
        <p className="text-3xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
          <Moon size={11} /> Średnie wskaźniki snu
        </p>
        <div className="grid grid-cols-3 gap-3 items-end">
          <div className="col-span-1">
            <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">Śr. sen</p>
            <p className="mt-0.5 text-xl font-black text-text-primary tracking-tight">
              {formatDurationHours(data?.sleepAvgHours)}
            </p>
          </div>
          <div className="col-span-1">
            <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">HRV śr.</p>
            <p className="mt-0.5 text-lg font-extrabold text-primary">
              {data?.avgHrv == null ? '—' : `${data.avgHrv} ms`}
            </p>
          </div>
          <div className="col-span-1">
            <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">Efektywność</p>
            <p className="mt-0.5 text-lg font-extrabold text-text-primary">
              {data?.avgEfficiency == null ? '—' : `${data.avgEfficiency}%`}
            </p>
          </div>
        </div>

        {/* Sub-metrics row */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-custom/30 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-surface/50 px-2.5 py-1.5">
            <span className="text-text-muted font-medium">Głęboki / REM</span>
            <span className="font-bold text-text-primary">
              {formatDurationHours(data?.avgDeepHours)} / {formatDurationHours(data?.avgRemHours)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface/50 px-2.5 py-1.5">
            <span className="text-text-muted font-medium">Okno snu</span>
            <span className="font-bold text-text-primary">
              {data?.avgBedtime ?? '—'} – {data?.avgWake ?? '—'}
            </span>
          </div>
        </div>

        {/* Best vs Worst night */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-surface/50 px-2.5 py-1.5">
            <span className="text-text-muted font-medium">Najlepszy</span>
            <span className="font-bold text-success">{formatSleepDayLabel(data?.sleepBest ?? null, today)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface/50 px-2.5 py-1.5">
            <span className="text-text-muted font-medium">Najgorszy</span>
            <span className="font-bold text-warning">{formatSleepDayLabel(data?.sleepWorst ?? null, today)}</span>
          </div>
        </div>
      </div>

      {/* Section 3: Clean Signal Pills */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {data?.sleepAvgScore != null && (
          <Badge variant="tag" className="text-3xs font-bold">
            Sleep {data.sleepAvgScore}
          </Badge>
        )}
        {data?.avgReadiness != null && (
          <Badge variant="tag" className="text-3xs font-bold">
            Readiness {data.avgReadiness}
          </Badge>
        )}
        {data?.avgLatencyMin != null && (
          <Badge variant="tag" className="text-3xs font-bold">
            Zasypianie {data.avgLatencyMin}m
          </Badge>
        )}
        {data?.averageRecovery != null && (
          <Badge variant="tag" className="text-3xs font-bold">
            Recovery {data.averageRecovery}
          </Badge>
        )}
        {data && data.warningDays > 0 && (
          <Badge variant="tag" color="var(--color-warning)" className="text-3xs font-bold">
            {data.warningDays}d poniżej normy
          </Badge>
        )}
      </div>
    </section>
  );
}

function ActivityChip({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 transition-all ${
      active
        ? 'bg-primary/10 border border-primary/20 text-primary'
        : 'bg-surface/50 border border-border-custom/30 text-text-muted'
    }`}>
      <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-0.5 text-xs font-black ${active ? 'text-text-primary' : 'text-text-muted'}`}>{value}</p>
    </div>
  );
}

function formatRuns(data: WeeklyBodyPulseData | undefined): string {
  if (!data) return '0';
  if (data.runCount === 0) return '0';
  return data.runKm > 0 ? `${data.runCount} · ${data.runKm} km` : `${data.runCount}`;
}

function formatSauna(data: WeeklyBodyPulseData | undefined): string {
  if (!data) return '0';
  if (data.saunaCount === 0) return '0';
  return data.saunaMinutes > 0 ? `${data.saunaCount} · ${data.saunaMinutes} min` : `${data.saunaCount}`;
}
