import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Target, AlertCircle } from 'lucide-react';
import { MagazineBar } from '../shared/MagazineBar';
import WeekLoopSummary from '../shared/WeekLoopSummary';
import ProjectWeekKpis from './ProjectWeekKpis';
import { SystemProposalCard } from '../shared/SystemProposalCard';
import { useDirectionContext } from '../../hooks/useDirectionContext';
import { mergeMagazineView, loadOracleScheduleOverride } from '../../lib/magazineBar';
import {
  fetchPendingProposals,
  resolveProposal,
  syncFrictionProposals,
  type SystemProposal,
} from '../../lib/systemProposals';
import { getTodayWarsaw } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth';

export default function WeekHub({
  session,
  onOpenActionCenter,
}: {
  session: Session;
  onOpenActionCenter?: () => void;
}) {
  const userId = session.user.id;
  const weekStart = getWeekStartWarsaw(getTodayWarsaw());
  const direction = useDirectionContext(userId, weekStart);
  const [proposals, setProposals] = useState<SystemProposal[]>([]);

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
    void reloadProposals();
  }, [reloadProposals]);

  const openMust = direction.openMustPins ?? [];

  return (
    <div className="space-y-5">
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

      {direction.weekStart && (direction.activeProjects?.length ?? 0) > 0 && (
        <ProjectWeekKpis userId={userId} projects={direction.activeProjects!} weekStart={direction.weekStart} />
      )}

      {direction.weekStart && (
        <WeekLoopSummary
          ctx={{
            weekGoals: direction.weekGoals ?? { intention: null, commitment: null, cialo: null, duch: null, konto: null },
            powerListStats: direction.powerListStats ?? { daysLogged: 0, daysWithWins: 0, tasksDone: 0, tasksSet: 0 },
            mustPins: direction.mustPins ?? [],
            openMustPins: direction.openMustPins ?? [],
            focus: direction.focus ?? { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
            weekCheckpointsDone: direction.weekCheckpointsDone ?? 0,
            weekCheckpointsDue: direction.weekCheckpointsDue ?? 0,
            sprintGoal: direction.sprintGoal ?? null,
            sprintLabel: direction.sprintLabel ?? null,
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
