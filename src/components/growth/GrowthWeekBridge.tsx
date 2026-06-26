import { Link } from 'react-router-dom';
import { Calendar, Compass, ListChecks, Target, TrendingUp } from 'lucide-react';
import type { GrowthContextData } from '../../hooks/useGrowthData';
import type { PowerListWeekStats } from '../../lib/growthWeek';
import { KpiTrendSparkline } from '../projects/KpiTrendSparkline';

const PILLAR_META = [
  { key: 'cialo' as const, label: 'Ciało', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'duch' as const, label: 'Duch', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
  { key: 'konto' as const, label: 'Konto', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
];

export default function GrowthWeekBridge({
  context,
  powerListStats,
  userId,
  mustDone,
  mustTotal,
  focusLabel,
  focusScore,
  focusTarget,
}: {
  context: GrowthContextData;
  powerListStats: PowerListWeekStats;
  userId: string;
  mustDone: number;
  mustTotal: number;
  focusLabel: string | null;
  focusScore: number | null;
  focusTarget: number | null;
}) {
  const { weekGoals } = context;
  const hasDirection =
    weekGoals.intention ||
    weekGoals.cialo ||
    weekGoals.duch ||
    weekGoals.konto ||
    weekGoals.commitment;

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
            <Compass size={11} /> Most tygodnia
          </p>
          <p className="text-[10px] text-text-muted mt-1">Cele z Direction · egzekucja z PowerList · nauka poniżej</p>
        </div>
        <Link
          to="/"
          className="shrink-0 text-[9px] font-black uppercase text-primary hover:underline"
          title="Otwórz app → zakładka Tydzień (Direction)"
        >
          Direction →
        </Link>
      </div>

      {!hasDirection ? (
        <div className="rounded-xl border border-dashed border-border-custom px-3 py-2.5 space-y-1.5">
          {context.sprintGoal ? (
            <p className="text-[11px] font-semibold text-text-secondary leading-snug">
              Sprint jest ustawiony — możesz już wybrać focus skill i MUST poniżej.
            </p>
          ) : null}
          <p className="text-[11px] text-text-muted">
            {context.sprintGoal ? 'Opcjonalnie dopnij ' : 'Brak celów tygodnia — ustaw je w '}
            <Link to="/" className="text-primary font-bold">
              Direction (Tydzień)
            </Link>
            {context.sprintGoal
              ? ', żeby focus miał kontekst filarów (ciało / duch / konto).'
              : ', potem wróć tu po focus skill i MUST nauki.'}
          </p>
        </div>
      ) : (
        <>
          {(weekGoals.intention || weekGoals.commitment) && (
            <p className="text-[12px] font-semibold text-text-primary leading-snug italic">
              „{weekGoals.intention || weekGoals.commitment}"
            </p>
          )}
          <div className="space-y-1.5">
            {PILLAR_META.filter((p) => weekGoals[p.key]).map((p) => (
              <div key={p.key} className="flex items-start gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${p.bg} ${p.color}`}
                >
                  {p.label}
                </span>
                <span className="text-[11px] font-semibold text-text-secondary leading-snug">{weekGoals[p.key]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        {context.sprintGoal && (
          <div className="rounded-xl border border-border-custom bg-surface/40 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[7px] font-black uppercase text-text-muted">
              <Target size={9} /> {context.sprintLabel}
            </p>
            <p className="text-[10px] font-bold text-text-primary line-clamp-2 mt-0.5">{context.sprintGoal}</p>
          </div>
        )}
        {context.kpiName && context.kpiId && (
          <div className="rounded-xl border border-border-custom bg-surface/40 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[7px] font-black uppercase text-text-muted">
              <TrendingUp size={9} /> KPI
            </p>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <p className="text-[10px] font-bold text-text-primary truncate">
                {context.kpiName}
                {context.kpiValue != null && (
                  <span className="text-primary ml-0.5">
                    {context.kpiValue}
                    {context.kpiTarget != null && `/${context.kpiTarget}`}
                  </span>
                )}
              </p>
              <KpiTrendSparkline kpiId={context.kpiId} userId={userId} target={context.kpiTarget} />
            </div>
          </div>
        )}
        <div className="rounded-xl border border-border-custom bg-surface/40 px-2.5 py-2">
          <p className="flex items-center gap-1 text-[7px] font-black uppercase text-text-muted">
            <ListChecks size={9} /> PowerList
          </p>
          <p className="text-[10px] font-bold text-text-primary mt-0.5">
            {powerListStats.tasksDone}/{powerListStats.tasksSet || '—'} zadań
            <span className="text-text-muted font-semibold"> · {powerListStats.daysWithWins}d z dowozem</span>
          </p>
        </div>
        {focusLabel && (
          <div className="rounded-xl border border-border-custom bg-surface/40 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[7px] font-black uppercase text-text-muted">
              <Calendar size={9} /> Nauka
            </p>
            <p className="text-[10px] font-bold text-text-primary mt-0.5 truncate">
              {focusLabel}
              {focusScore != null && focusTarget != null && (
                <span className="text-primary ml-0.5">
                  {focusScore}→{focusTarget}
                </span>
              )}
              {mustTotal > 0 && (
                <span className="text-text-muted font-semibold"> · MUST {mustDone}/{mustTotal}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
