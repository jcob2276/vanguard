import type { SprintPanelProps } from './SprintPanel';
import { Card } from '../../ui/Card';

interface BodyMetric {
  label: string;
  curr: number | null | undefined;
  prev: number | null | undefined;
  fmt: (v: number) => string;
  dec?: number;
}

function delta(curr: number | null | undefined, prev: number | null | undefined, decimals = 0) {
  if (curr == null || prev == null) return null;
  const d = +(curr - prev).toFixed(decimals);
  return d !== 0 ? { abs: Math.abs(d), up: d > 0 } : null;
}

export default function SprintMetricsGrid({
  metrics,
  prevMetrics,
  projectMetrics,
  goals,
  currentWeight,
  weight30ago,
}: Pick<
  SprintPanelProps,
  'metrics' | 'prevMetrics' | 'projectMetrics' | 'goals' | 'currentWeight' | 'weight30ago'
>) {
  const BODY: BodyMetric[] = [
    {
      label: 'Readiness',
      curr: metrics?.avgReadiness,
      prev: prevMetrics?.avgReadiness,
      fmt: (v: number) => `${Math.round(v)}`,
    },
    { label: 'Sen avg', curr: metrics?.avgSleep, prev: prevMetrics?.avgSleep, fmt: (v: number) => `${v.toFixed(1)}h`, dec: 1 },
    { label: 'Treningi', curr: metrics?.trainDays, prev: prevMetrics?.trainDays, fmt: (v: number) => `${v}×` },
    { label: 'Km biegu', curr: metrics?.kmRun, prev: prevMetrics?.kmRun, fmt: (v: number) => `${v.toFixed(0)}`, dec: 1 },
    {
      label: 'Objętość',
      curr: metrics?.totalVol ? +(metrics.totalVol / 1000).toFixed(1) : null,
      prev: prevMetrics?.totalVol ? +(prevMetrics.totalVol / 1000).toFixed(1) : null,
      fmt: (v: number) => `${v}Mg`,
      dec: 1,
    },
    ...(currentWeight != null
      ? [{ label: 'Waga', curr: currentWeight, prev: weight30ago, fmt: (v: number) => `${v.toFixed(1)}`, dec: 1 }]
      : []),
  ];

  const PROJECTS = [
    { label: 'Done w sprincie', val: projectMetrics?.doneInSprint, color: 'text-success' },
    { label: 'W toku', val: projectMetrics?.inProgress, color: 'text-info' },
    { label: 'Zablokowane', val: projectMetrics?.blocked, color: projectMetrics?.blocked > 0 ? 'text-danger' : 'text-text-primary' },
    { label: 'Projekty', val: projectMetrics?.activeProjects, color: 'text-warning' },
  ];

  return (
    <div className="grid grid-cols-3 gap-6 pt-5 border-t border-primary/10">
      <div>
        <p className="text-2xs font-black uppercase tracking-[0.25em] text-success mb-3">Ciało · sprint</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          {BODY.map(({ label, curr, prev, fmt, dec }) => {
            const d = curr != null && prev != null ? delta(curr, prev, dec ?? 0) : null;
            return (
              <div key={label}>
                <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
                <p className="font-display text-lg font-black leading-none text-text-primary">
                  {curr != null ? fmt(curr) : '—'}
                </p>
                {d && (
                  <p className={`text-2xs font-bold mt-0.5 ${d.up ? 'text-success' : 'text-danger'}`}>
                    {d.up ? '↑' : '↓'} {fmt(d.abs)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-2xs font-black uppercase tracking-[0.25em] text-warning mb-3">Projekty · sprint</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          {PROJECTS.map(({ label, val, color }) => (
            <div key={label}>
              <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
              <p className={`font-display text-lg font-black leading-none ${color}`}>{val ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-2xs font-black uppercase tracking-[0.25em] text-primary mb-3">Cele kierunkowe</p>
        <div className="space-y-2">
          {goals?.goal_konto && (
            <Card variant="outline" padding="0.625rem 0.75rem" className="!rounded-[10px] !bg-warning/[0.06] !border-warning/15 hover:scale-[1.03] hover:shadow-md hover:!border-warning/30 cursor-default">
              <p className="text-3xs font-black uppercase tracking-wider text-warning mb-1">Konto</p>
              <p className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">{goals.goal_konto}</p>
            </Card>
          )}
          {goals?.goal_duch && (
            <Card variant="outline" padding="0.625rem 0.75rem" className="!rounded-[10px] !bg-primary/[0.06] !border-primary/15 hover:scale-[1.03] hover:shadow-md hover:!border-primary/30 cursor-default">
              <p className="text-3xs font-black uppercase tracking-wider text-primary mb-1">Duch</p>
              <p className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">{goals.goal_duch}</p>
            </Card>
          )}
          {!goals?.goal_konto && !goals?.goal_duch && (
            <p className="text-xs text-text-muted italic">Brak celów kierunkowych</p>
          )}
        </div>
      </div>
    </div>
  );
}
