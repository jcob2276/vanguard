import WeekLoopSummary from '../shared/WeekLoopSummary';
import ProjectWeekKpis from './ProjectWeekKpis';
import { useDirectionContext } from './direction/hooks/useDirectionContext';
import { Card } from '../ui/Card';

/** Read-only week hub snapshot at the top of Sunday planning — same data as WeekHub radar. */
export default function WeekPlanningRecap({
  userId,
  weekStart,
}: {
  userId: string;
  weekStart: string;
}) {
  const direction = useDirectionContext(userId, weekStart);

  if (direction.loading) {
    return (
      <div className="rounded-2xl border border-border-custom bg-surface/30 px-4 py-6 text-center text-xs text-text-muted animate-pulse">
        Wczytuję podsumowanie tygodnia…
      </div>
    );
  }

  const hasProjects = (direction.activeProjects?.length ?? 0) > 0;
  const hasLoop =
    direction.weekGoals?.intention ||
    direction.weekGoals?.commitment ||
    direction.weekGoals?.cialo ||
    direction.weekGoals?.duch ||
    direction.weekGoals?.konto ||
    (direction.powerListStats?.tasksSet ?? 0) > 0;

  if (!hasProjects && !hasLoop) return null;

  return (
    <Card variant="receipt" className="space-y-4" style={{ background: 'var(--primary-5)' }}>
      <div>
        <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-primary">
          Ten tydzień — zoom out
        </p>
        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
          To samo co w Radarze tygodnia. Teraz refleksja — nie zaczynaj od pustego formularza.
        </p>
      </div>

      {hasLoop && (
        <WeekLoopSummary
          compact
          ctx={{
            weekGoals: direction.weekGoals ?? { intention: null, commitment: null, cialo: null, duch: null, konto: null },
            weekGoalsMeta: direction.weekGoalsMeta,
            powerListStats: direction.powerListStats ?? { daysLogged: 0, daysWithWins: 0, tasksDone: 0, tasksSet: 0 },
            mustPins: direction.mustPins ?? [],
            openMustPins: direction.openMustPins ?? [],
            focus: direction.focus ?? { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
            weekCheckpointsDone: direction.weekCheckpointsDone ?? 0,
            weekCheckpointsDue: direction.weekCheckpointsDue ?? 0,
            sprintGoal: direction.sprintGoal ?? null,
            sprintLabel: direction.sprintLabel ?? null,
            monthTheme: direction.monthTheme ?? null,
            monthLabel: direction.monthLabel ?? null,
            bhagLine: direction.bhagLine ?? null,
          }}
        />
      )}

      {hasProjects && direction.weekStart && (
        <ProjectWeekKpis
          readOnly
          userId={userId}
          projects={direction.activeProjects!}
          weekStart={direction.weekStart}
          focusProjectIds={direction.sprintFocusProjectIds ?? []}
        />
      )}
    </Card>
  );
}
