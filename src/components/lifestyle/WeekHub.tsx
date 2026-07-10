import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CalendarDays, Target, AlertCircle, ChevronRight } from 'lucide-react';
import { MagazineBar } from '../shared/MagazineBar';
import WeekLoopSummary from '../shared/WeekLoopSummary';
import ProjectWeekKpis from './ProjectWeekKpis';
import WeeklyBalanceHexagon from './WeeklyBalanceHexagon';
import { SystemProposalCard } from '../shared/SystemProposalCard';
import { useDirectionContext } from './direction/hooks/useDirectionContext';
import { useSpineGuidance } from '../growth/hooks/useSpineGuidance';
import { mergeMagazineView, loadOracleScheduleOverride } from '../../lib/magazineBar';
import {
  fetchPendingProposals,
  resolveProposal,
  syncFrictionProposals,
  type SystemProposal,
} from '../../lib/systemProposals';
import { getTodayWarsaw } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';

export default function WeekHub({
  session,
  onOpenActionCenter,
  onStartWeeklyReview,
}: {
  session: Session;
  onOpenActionCenter?: () => void;
  onStartWeeklyReview?: () => void;
}) {
  const userId = session.user.id;
  const weekStart = getWeekStartWarsaw(getTodayWarsaw());
  const today = getTodayWarsaw();
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  const direction = useDirectionContext(userId, weekStart);
  const { guidance } = useSpineGuidance(userId);
  const [proposals, setProposals] = useState<SystemProposal[]>([]);

  const weekReflectionPending = guidance?.steps.some(
    (s) => s.id === 'week_reflection' && s.status !== 'done',
  );
  const showReviewCta = Boolean(weekReflectionPending && onStartWeeklyReview);
  const sundayReviewCta = showReviewCta && isSunday;
  const overdueReviewCue = showReviewCta && !isSunday;

  const magazineView = useMemo(() => {
    if (!direction.weekStart || direction.loading) return null;
    const ctx = {
      weekStart: direction.weekStart,
      weekGoals: direction.weekGoals ?? { intention: null, commitment: null, cialo: null, duch: null, konto: null },
      checkpoints: direction.checkpoints ?? { all: [], overdue: [], upcoming: [] },
      mustPins: direction.mustPins ?? [],
      openMustPins: direction.openMustPins ?? [],
      urgentTodos: direction.urgentTodos ?? [],
      activeProjects: direction.activeProjects ?? [],
      powerListStats: direction.powerListStats ?? { daysLogged: 0, daysWithWins: 0, tasksDone: 0, tasksSet: 0 },
      sprintGoal: direction.sprintGoal ?? null,
      sprintLabel: direction.sprintLabel ?? null,
      sprintFocusProjectIds: direction.sprintFocusProjectIds ?? [],
      monthTheme: direction.monthTheme ?? null,
      monthLabel: direction.monthLabel ?? null,
      bhagLine: direction.bhagLine ?? null,
      focus: direction.focus ?? { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
      weekCheckpointsDone: direction.weekCheckpointsDone ?? 0,
      weekCheckpointsDue: direction.weekCheckpointsDue ?? 0,
      skills: direction.skills ?? [],
    };
    return mergeMagazineView(ctx, loadOracleScheduleOverride());
  }, [direction]);

  const reloadProposals = useCallback(async () => {
    await syncFrictionProposals(userId);
    setProposals(await fetchPendingProposals(userId));
  }, [userId]);

  useEffect(() => {
    void (async () => { await reloadProposals(); })();
  }, [reloadProposals]);

  const openMust = direction.openMustPins ?? [];

  return (
    <div className="space-y-5">
      {sundayReviewCta && (
        <button
          type="button"
          onClick={onStartWeeklyReview}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3.5 text-left transition-colors hover:bg-primary/15 active:scale-[0.99]"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
              <CalendarDays size={12} /> Zamknięcie tygodnia
            </p>
            <p className="mt-1 text-[13px] font-semibold text-text-primary leading-snug">
              Niedziela — refleksja + plan następnego tygodnia
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-primary" />
        </button>
      )}

      {overdueReviewCue && (
        <button
          type="button"
          onClick={onStartWeeklyReview}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3.5 text-left transition-colors hover:bg-amber-500/10 active:scale-[0.99]"
        >
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Refleksja tygodnia</p>
            <p className="mt-1 text-[12px] text-text-secondary leading-relaxed">
              {guidance?.primaryCue?.includes('refleksji')
                ? guidance.primaryCue
                : 'Zamknij tydzień tutaj — refleksja + plan następnego tygodnia.'}
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-amber-600" />
        </button>
      )}

      {proposals.length > 0 && (
        <section className="space-y-3">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-600">
            <AlertCircle size={12} /> Do decyzji ({proposals.length})
          </p>
          {proposals.slice(0, 2).map((p) => (
            <SystemProposalCard
              key={p.id}
              proposal={p}
              onResolved={async (id, status) => {
                await resolveProposal(id, status);
                await reloadProposals();
              }}
            />
          ))}
          {proposals.length > 2 && onOpenActionCenter && (
            <button
              type="button"
              onClick={onOpenActionCenter}
              className="text-[11px] font-semibold text-primary"
            >
              +{proposals.length - 2} więcej w Action Center
            </button>
          )}
        </section>
      )}

      {magazineView && <MagazineBar view={magazineView} />}

      <WeeklyBalanceHexagon userId={userId} />

      {direction.weekStart && (direction.activeProjects?.length ?? 0) > 0 && (
        <ProjectWeekKpis
          userId={userId}
          projects={direction.activeProjects!}
          weekStart={direction.weekStart}
          focusProjectIds={direction.sprintFocusProjectIds ?? []}
        />
      )}

      {direction.weekStart && (
        <WeekLoopSummary
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

      {openMust.length > 0 && (
        <section className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">
            <Target size={12} /> Must tygodnia ({openMust.length})
          </p>
          <ul className="space-y-2">
            {openMust.map((pin) => (
              <li
                key={pin.id}
                className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-[13px] font-semibold text-text-primary"
              >
                {pin.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
