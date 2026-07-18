import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWeeklyBodyPulse } from '../../lib/biometricsApi';
import { useUserId } from '../../store/useStore';
import { needsRecoveryCorrection } from '../../lib/horizonSignals';

export default function WeeklyBodyPulse() {
  const userId = useUserId();
  const { data } = useWeeklyBodyPulse(userId ?? '');
  if (!userId) return null;

  const needsAttention = Boolean(data && needsRecoveryCorrection(data));
  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-text-muted"><Activity size={12} /> Ciało · 7 dni</p>
          <p className="mt-1 text-base font-bold text-text-primary">{needsAttention ? 'Regeneracja wymaga uwagi' : 'Obciążenie jest pod kontrolą'}</p>
        </div>
        {needsAttention ? <AlertCircle className="text-warning" size={18} /> : <CheckCircle2 className="text-success" size={18} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Śr. recovery" value={data?.averageRecovery == null ? '—' : `${data.averageRecovery}`} />
        <Metric label="Treningi" value={`${data?.workoutCount ?? 0}`} />
        <Metric label="Dni z limitem" value={`${data?.warningDays ?? 0}`} />
      </div>
      {needsAttention ? <p className="mt-3 text-xs leading-relaxed text-text-muted">Nie zmieniam planu automatycznie. Przy korekcie tygodnia rozważ więcej marginesu między mocnymi blokami.</p> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{label}</p><p className="mt-1 text-sm font-black text-text-primary">{value}</p></div>;
}
