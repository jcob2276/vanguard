import { Link } from 'react-router-dom';
import { Calendar, FolderKanban, Target, TrendingUp } from 'lucide-react';
import type { GrowthContextData } from '../../hooks/useGrowthData';
import { KpiTrendSparkline } from '../projects/KpiTrendSparkline';

export default function GrowthContextStrip({
  context,
  userId,
}: {
  context: GrowthContextData;
  userId: string;
}) {
  const hasAny =
    context.weekIntention ||
    context.sprintGoal ||
    context.activeProjectName ||
    context.kpiName;

  if (!hasAny) {
    return (
      <p className="text-[11px] text-text-muted rounded-xl border border-dashed border-border-custom p-4 text-center">
        Brak kontekstu — uzupełnij{' '}
        <Link to="/" className="text-primary font-bold">
          Tydzień
        </Link>{' '}
        lub{' '}
        <Link to="/" className="text-primary font-bold">
          Projekty
        </Link>
        .
      </p>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-2">
      {context.weekIntention && (
        <div className="col-span-2 rounded-xl border border-border-custom bg-surface/30 p-3">
          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-text-muted">
            <Calendar size={10} /> Intencja tygodnia
          </p>
          <p className="mt-1 text-[12px] font-semibold text-text-primary leading-snug line-clamp-3">
            {context.weekIntention}
          </p>
        </div>
      )}
      {context.sprintGoal && (
        <div className="rounded-xl border border-border-custom bg-surface/30 p-3">
          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-text-muted">
            <Target size={10} /> {context.sprintLabel}
          </p>
          <p className="mt-1 text-[11px] font-bold text-text-primary line-clamp-2">{context.sprintGoal}</p>
        </div>
      )}
      {context.activeProjectName && (
        <div className="rounded-xl border border-border-custom bg-surface/30 p-3">
          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-text-muted">
            <FolderKanban size={10} /> Projekt
          </p>
          <p className="mt-1 text-[11px] font-bold text-text-primary truncate">{context.activeProjectName}</p>
        </div>
      )}
      {context.kpiName && context.kpiId && (
        <div className="col-span-2 rounded-xl border border-border-custom bg-surface/30 p-3">
          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-text-muted">
            <TrendingUp size={10} /> KPI
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-text-primary">
              {context.kpiName}
              {context.kpiValue != null && (
                <span className="text-primary ml-1">
                  {context.kpiValue}
                  {context.kpiTarget != null && ` / ${context.kpiTarget}`}
                </span>
              )}
            </p>
            <KpiTrendSparkline
              kpiId={context.kpiId}
              userId={userId}
              target={context.kpiTarget}
            />
          </div>
        </div>
      )}
    </section>
  );
}
