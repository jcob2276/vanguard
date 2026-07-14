import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ListChecks, Target, TrendingUp } from 'lucide-react';
import type { DirectionContextData } from '../../lib/dailyPlanProposal';
import { formatSprintWeekBridge } from '../../lib/goal/goalSpine';
import { formatSprintFromLongTerm } from '../../lib/goal/longTermBridge';
import { Card } from '../ui/Card';

export default function WeekLoopSummary({
  ctx,
  compact = false,
}: {
  ctx: Pick<
    DirectionContextData,
    | 'weekGoals'
    | 'weekGoalsMeta'
    | 'powerListStats'
    | 'mustPins'
    | 'openMustPins'
    | 'focus'
    | 'weekCheckpointsDone'
    | 'weekCheckpointsDue'
    | 'sprintGoal'
    | 'sprintLabel'
    | 'monthTheme'
    | 'monthLabel'
    | 'bhagLine'
  >;
  compact?: boolean;
}) {
  const mustDone = ctx.mustPins.filter((p) => p.slot === 'must' && p.done).length;
  const mustTotal = ctx.mustPins.filter((p) => p.slot === 'must').length;
  const intention = ctx.weekGoals.intention || ctx.weekGoals.commitment;
  const sprintBridge = formatSprintWeekBridge(ctx.sprintGoal, intention);
  const longTermBridge = formatSprintFromLongTerm(ctx.bhagLine ?? null, ctx.sprintGoal);

  return (
    <Card className={compact ? 'space-y-2' : 'space-y-3'} padding={compact ? '0.875rem' : '1.25rem'}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Pętla tygodnia</p>

      {longTermBridge && (
        <p className={`text-text-secondary leading-snug ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {longTermBridge}
        </p>
      )}

      {ctx.monthTheme && (
        <p className={`text-text-secondary leading-snug ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          <span className="font-black uppercase tracking-wider text-primary">
            Temat miesiąca{ctx.monthLabel ? ` · ${ctx.monthLabel}` : ''}:{' '}
          </span>
          {ctx.monthTheme}
        </p>
      )}

      {sprintBridge && (
        <p className={`font-semibold text-text-primary leading-snug ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {sprintBridge}
        </p>
      )}
      {intention ? (
        <div className="space-y-1">
          <p className={`font-bold text-text-primary leading-snug ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{intention}</p>
          {ctx.weekGoalsMeta?.source === 'fallback' && (
            <p className="text-[10px] font-semibold text-warning">
              Plan z poprzedniego tygodnia — uzupełnij w niedzielnym przeglądzie.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-text-muted">
          Brak intencji —{' '}
          <Link to="/?view=tydzien" className="text-primary font-bold hover:underline">
            uzupełnij w Tydzień
          </Link>
        </p>
      )}

      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <MiniStat
          icon={<ListChecks size={10} />}
          label="5 zwycięstw"
          value={`${ctx.powerListStats.tasksDone}/${ctx.powerListStats.tasksSet || '?'}`}
          sub={`${ctx.powerListStats.daysWithWins}d aktywnych`}
        />
        <MiniStat
          icon={<Target size={10} />}
          label="MUST"
          value={`${mustDone}/${mustTotal || 3}`}
          sub={mustTotal ? undefined : 'Ustaw w Rozwoju'}
        />
        <MiniStat
          icon={<CalendarDays size={10} />}
          label="Checkpointy"
          value={`${ctx.weekCheckpointsDone}/${ctx.weekCheckpointsDone + ctx.weekCheckpointsDue}`}
          sub="zamknięte / otwarte w tyg."
        />
        <MiniStat
          icon={<TrendingUp size={10} />}
          label={ctx.sprintLabel ?? 'Sprint'}
          value={`tyg. ${ctx.sprintLabel?.replace('Sprint ', '') ?? '—'}`}
        />
      </div>

      {ctx.focus.skillLabel && (
        <p className="text-[10px] text-text-secondary">
          <span className="font-black text-text-muted">Focus: </span>
          {ctx.focus.skillLabel}
          {ctx.focus.subskillLabel ? ` → ${ctx.focus.subskillLabel}` : ''}
          {ctx.focus.targetLevel != null ? ` · cel ${ctx.focus.targetLevel}/5` : ''}
        </p>
      )}

      {(ctx.weekGoals.cialo || ctx.weekGoals.duch || ctx.weekGoals.konto) && !compact && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border-custom/50">
          {ctx.weekGoals.cialo && <PillarChip label="Ciało" text={ctx.weekGoals.cialo} cls="text-success" />}
          {ctx.weekGoals.duch && <PillarChip label="Duch" text={ctx.weekGoals.duch} cls="text-primary" />}
          {ctx.weekGoals.konto && <PillarChip label="Konto" text={ctx.weekGoals.konto} cls="text-warning" />}
        </div>
      )}
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border-custom bg-background/50 px-2.5 py-2 min-w-0">
      <p className="flex items-center gap-1 text-[7px] font-black uppercase text-text-muted truncate">
        {icon} {label}
      </p>
      <p className="text-[11px] font-black text-text-primary mt-0.5 truncate" title={value}>
        {value}
      </p>
      {sub && <p className="text-[8px] text-text-muted truncate">{sub}</p>}
    </div>
  );
}

function PillarChip({ label, text, cls }: { label: string; text: string; cls: string }) {
  return (
    <span className="text-[9px] text-text-secondary max-w-full">
      <span className={`font-black ${cls}`}>{label}: </span>
      {text}
    </span>
  );
}
