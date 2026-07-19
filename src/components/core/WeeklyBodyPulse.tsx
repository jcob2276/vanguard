import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-text-muted">
            <Activity size={12} /> Ciało · 7 dni
          </p>
          <p className="mt-1 text-base font-bold text-text-primary">
            {isLoading ? 'Ładuję przebieg…' : isError ? 'Brak pełnych danych ciała' : data ? bodyPulseHeadline(data) : 'Brak danych'}
          </p>
        </div>
        {needsAttention ? <AlertCircle className="text-warning" size={18} /> : <CheckCircle2 className="text-success" size={18} />}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Siłownia" value={`${data?.gymCount ?? 0}`} />
        <Metric label="Bieganie" value={formatRuns(data)} />
        <Metric label="Sauna" value={formatSauna(data)} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Śr. sen" value={formatDurationHours(data?.sleepAvgHours)} />
        <Metric label="Zasypianie" value={data?.avgBedtime ?? '—'} />
        <Metric label="Wstawanie" value={data?.avgWake ?? '—'} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Deep" value={formatDurationHours(data?.avgDeepHours)} />
        <Metric label="REM" value={formatDurationHours(data?.avgRemHours)} />
        <Metric label="Efektywność" value={data?.avgEfficiency == null ? '—' : `${data.avgEfficiency}%`} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Najlepszy" value={formatSleepDayLabel(data?.sleepBest ?? null, today)} />
        <Metric label="Najgorszy" value={formatSleepDayLabel(data?.sleepWorst ?? null, today)} />
        <Metric label="HRV śr." value={data?.avgHrv == null ? '—' : `${data.avgHrv} ms`} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-text-muted">
        {[
          data?.sleepAvgScore != null ? `Sleep score ${data.sleepAvgScore}` : null,
          data?.avgReadiness != null ? `Readiness ${data.avgReadiness}` : null,
          data?.avgLatencyMin != null ? `Latency ${data.avgLatencyMin} min` : null,
          data?.averageRecovery != null ? `Recovery ${data.averageRecovery}` : null,
          data && data.warningDays > 0 ? `${data.warningDays}d yellow/red` : null,
        ].filter(Boolean).join(' · ') || 'Brak dodatkowych sygnałów snu'}
      </p>
    </section>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-text-primary">{value}</p>
    </div>
  );
}
