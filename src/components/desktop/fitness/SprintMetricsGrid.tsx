import type { SprintPanelProps } from './SprintPanel';

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
    { label: 'Done w sprincie', val: projectMetrics?.doneInSprint, color: 'text-emerald-500' },
    { label: 'W toku', val: projectMetrics?.inProgress, color: 'text-sky-400' },
    { label: 'Zablokowane', val: projectMetrics?.blocked, color: projectMetrics?.blocked > 0 ? 'text-rose-500' : 'text-text-primary' },
    { label: 'Projekty', val: projectMetrics?.activeProjects, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-6 pt-5 border-t border-primary/10">
      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-3">Ciało · sprint</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          {BODY.map(({ label, curr, prev, fmt, dec }) => {
            const d = curr != null && prev != null ? delta(curr, prev, dec ?? 0) : null;
            return (
              <div key={label}>
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
                <p className="font-display text-[18px] font-black leading-none text-text-primary">
                  {curr != null ? fmt(curr) : '—'}
                </p>
                {d && (
                  <p className={`text-[8px] font-bold mt-0.5 ${d.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {d.up ? '↑' : '↓'} {fmt(d.abs)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 mb-3">Projekty · sprint</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          {PROJECTS.map(({ label, val, color }) => (
            <div key={label}>
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
              <p className={`font-display text-[18px] font-black leading-none ${color}`}>{val ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-3">Cele kierunkowe</p>
        <div className="space-y-2">
          {goals?.goal_konto && (
            <div className="rounded-[10px] bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2.5 hover:scale-[1.03] hover:shadow-md hover:border-amber-500/30 transition-all duration-150 cursor-default">
              <p className="text-[7px] font-black uppercase tracking-wider text-amber-400 mb-1">Konto</p>
              <p className="text-[11px] font-semibold text-text-primary leading-snug line-clamp-2">{goals.goal_konto}</p>
            </div>
          )}
          {goals?.goal_duch && (
            <div className="rounded-[10px] bg-indigo-500/[0.06] border border-indigo-500/15 px-3 py-2.5 hover:scale-[1.03] hover:shadow-md hover:border-indigo-500/30 transition-all duration-150 cursor-default">
              <p className="text-[7px] font-black uppercase tracking-wider text-indigo-400 mb-1">Duch</p>
              <p className="text-[11px] font-semibold text-text-primary leading-snug line-clamp-2">{goals.goal_duch}</p>
            </div>
          )}
          {!goals?.goal_konto && !goals?.goal_duch && (
            <p className="text-[10px] text-text-muted italic">Brak celów kierunkowych</p>
          )}
        </div>
      </div>
    </div>
  );
}
