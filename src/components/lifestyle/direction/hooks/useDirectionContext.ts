import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUpcomingCheckpoints } from '../../../../lib/checkpoints';
import { getTodayWarsaw, warsawDayBoundsISO } from '../../../../lib/date';
import { getWeekStartWarsaw } from '../../../../lib/growth/growth';
import {
  computePowerListWeekStats,
  getWeekEndExclusive,
} from '../../../../lib/growth/growthWeek';
import { fetchGoalSpine, fetchLatestKpiValues } from '../../../../lib/goal/goalSpine';
import { primaryBhagLine } from '../../../../lib/goal/longTermBridge';
import { useGoalSpineInvalidation } from '../../../../hooks/useGoalSpineInvalidation';
import { fetchActiveProjects, fetchDirectionWeekBoard } from '../../../../lib/directionApi';
import type { DirectionContextData } from '../../../../lib/dailyPlanProposal';
import {
  mapMustPins,
  mapUrgentTodos,
  mapActiveProjects,
  mapDirectionFocus,
} from './directionContextHelpers';

export type { DirectionContextData };

const EMPTY_CHECKPOINTS: DirectionContextData['checkpoints'] = {
  all: [],
  overdue: [],
  upcoming: [],
};

export function useDirectionContext(userId: string | undefined, weekStartOverride?: string) {
  const weekStart = useMemo(
    () => weekStartOverride ?? getWeekStartWarsaw(getTodayWarsaw()),
    [weekStartOverride]
  );

  const { data, isLoading: loading, refetch } = useQuery<DirectionContextData | null>({
    queryKey: ['direction-context', userId, weekStart],
    queryFn: async () => {
      if (!userId) return null;
      const weekEnd = getWeekEndExclusive(weekStart);
      const { fromISO: weekFromISO } = warsawDayBoundsISO(weekStart);

      const [spine, checkpoints, projectsData, board] = await Promise.all([
        fetchGoalSpine(userId, weekStart),
        fetchUpcomingCheckpoints(userId, 14),
        fetchActiveProjects(userId),
        fetchDirectionWeekBoard(userId, weekStart, weekEnd, weekFromISO),
      ]);
      const [
        pinsRes,
        kpisRes,
        dailyWinsRes,
        focusRes,
        skillsRes,
        linksRes,
        todosRes,
        sectionsRes,
        doneCpsRes,
        dueCpsRes,
      ] = board;

      const overdue = checkpoints.filter((cp) => cp.isOverdue);
      const upcoming = checkpoints.filter((cp) => !cp.isOverdue);

      const linksMap = new Map((linksRes.data ?? []).map((l) => [l.id, l]));
      const todosMap = new Map((todosRes.data ?? []).map((t) => [t.id, t]));
      const sectionProject = new Map((sectionsRes.data ?? []).map((s) => [s.id, s.project_id]));

      const mustPins = mapMustPins(pinsRes.data ?? [], linksMap, todosMap);
      const openMustPins = mustPins.filter((p) => p.slot === 'must' && !p.done);

      const urgentTodos = mapUrgentTodos(todosRes.data ?? [], sectionProject, projectsData);

      const allKpis = kpisRes.data ?? [];
      const latestKpiValues = await fetchLatestKpiValues(userId, allKpis.map((k) => k.id));
      const activeProjects = mapActiveProjects(projectsData, allKpis, latestKpiValues);

      const skills = (skillsRes.data ?? []).map((s) => ({ id: s.id, label: s.label, key: s.key }));
      const skillsById = new Map(skills.map((s) => [s.id, s]));

      const subskill = focusRes.data?.subskill_id
        ? (skillsRes.data ?? []).find((s) => s.id === focusRes.data?.subskill_id)
        : null;
      const parentSkill = focusRes.data?.skill_id
        ? skillsById.get(focusRes.data.skill_id)
        : null;

      const focus = mapDirectionFocus(focusRes.data, parentSkill, subskill);

      const weekResolved = spine.week;
      const sprint = spine.sprint;

      const focusIds = sprint.focusProjectIds;
      if (focusIds.length > 0) {
        activeProjects.sort((a, b) => {
          const af = focusIds.includes(a.id) ? 0 : 1;
          const bf = focusIds.includes(b.id) ? 0 : 1;
          return af - bf;
        });
      }

      const weekGoals = {
        intention: weekResolved.intention,
        commitment: weekResolved.commitment,
        cialo: weekResolved.cialo,
        duch: weekResolved.duch,
        konto: weekResolved.konto,
      };

      const powerListStats = computePowerListWeekStats(dailyWinsRes.data ?? []);

      return {
        weekStart,
        weekGoals,
        weekGoalsMeta: {
          source: weekResolved.source,
          fallbackWeekStart: weekResolved.fallbackWeekStart,
        },
        checkpoints: { all: checkpoints, overdue, upcoming },
        mustPins,
        openMustPins,
        urgentTodos,
        activeProjects,
        powerListStats,
        sprintGoal: sprint.goalText,
        sprintLabel: sprint.label,
        sprintFocusProjectIds: sprint.focusProjectIds,
        monthTheme: spine.month.activeTheme,
        monthLabel: spine.month.activeMonthLabel,
        bhagLine: primaryBhagLine(spine.longTerm),
        focus,
        weekCheckpointsDone: doneCpsRes.count ?? 0,
        weekCheckpointsDue: dueCpsRes.count ?? 0,
        skills,
      };
    },
    enabled: !!userId,
  });

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useGoalSpineInvalidation(reload);
  const checkpoints = data?.checkpoints ?? EMPTY_CHECKPOINTS;

  return useMemo(
    () => ({
      weekStart: data?.weekStart ?? weekStart,
      weekGoals: data?.weekGoals,
      weekGoalsMeta: data?.weekGoalsMeta,
      mustPins: data?.mustPins,
      openMustPins: data?.openMustPins,
      parentSkills: data?.skills ?? [], // Expose skills as parentSkills matching ProjectCard expectation
      parentSkillsRaw: data?.skills ?? [], // For backward compatibility
      urgentTodos: data?.urgentTodos,
      activeProjects: data?.activeProjects,
      powerListStats: data?.powerListStats,
      sprintGoal: data?.sprintGoal,
      sprintLabel: data?.sprintLabel,
      sprintFocusProjectIds: data?.sprintFocusProjectIds ?? [],
      monthTheme: data?.monthTheme,
      monthLabel: data?.monthLabel,
      bhagLine: data?.bhagLine,
      focus: data?.focus,
      weekCheckpointsDone: data?.weekCheckpointsDone,
      weekCheckpointsDue: data?.weekCheckpointsDue,
      skills: data?.skills,
      checkpoints,
      loading,
      reload,
    }),
    [data, weekStart, checkpoints, loading, reload]
  );
}

