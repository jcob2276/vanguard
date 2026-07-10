import { useCallback, useEffect, useMemo, useState } from 'react';

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

import { supabase } from '../../../../lib/supabase';

import type {

  DirectionContextData,

  DirectionFocus,

  DirectionMustPin,

  DirectionProjectSummary,

  DirectionUrgentTodo,

} from '../../../../lib/dailyPlanProposal';



export type { DirectionContextData,     };



const EMPTY_CHECKPOINTS: DirectionContextData['checkpoints'] = {

  all: [],

  overdue: [],

  upcoming: [],

};



function resolvePinTitle(

  pin: {

    entity_type: string;

    entity_id: string | null;

    manual_title: string | null;

  },

  links: Map<string, { title: string | null }>,

  todos: Map<string, { title: string }>,

): string {

  if (pin.manual_title?.trim()) return pin.manual_title.trim();

  if (pin.entity_type === 'link' && pin.entity_id) {

    return links.get(pin.entity_id)?.title?.trim() || 'Link z Keep';

  }

  if (pin.entity_type === 'todo' && pin.entity_id) {

    return todos.get(pin.entity_id)?.title?.trim() || 'Zadanie';

  }

  return 'MUST tygodnia';

}



type ProjectRow = {

  id: string;

  name: string;

  goal: string | null;

  status: string;

  primary_skill_id?: string | null;

};



async function fetchActiveProjects(userId: string): Promise<ProjectRow[]> {

  const withSkill = await supabase

    .from('projects')

    .select('id, name, goal, status, primary_skill_id')

    .eq('user_id', userId)

    .eq('status', 'active')

    .order('created_at', { ascending: false });



  if (!withSkill.error) return (withSkill.data ?? []) as ProjectRow[];



  const fallback = await supabase

    .from('projects')

    .select('id, name, goal, status')

    .eq('user_id', userId)

    .eq('status', 'active')

    .order('created_at', { ascending: false });



  if (fallback.error) throw fallback.error;

  return (fallback.data ?? []).map((p) => ({ ...p, primary_skill_id: null }));

}



export function useDirectionContext(userId: string | undefined, weekStartOverride?: string) {

  const weekStart = useMemo(

    () => weekStartOverride ?? getWeekStartWarsaw(getTodayWarsaw()),

    [weekStartOverride],

  );

  const [loading, setLoading] = useState(true);

  const [data, setData] = useState<DirectionContextData | null>(null);



  const reload = useCallback(async () => {

    if (!userId) {

      setData(null);

      setLoading(false);

      return;

    }



    setLoading(true);

    try {

      const weekEnd = getWeekEndExclusive(weekStart);

      const { fromISO: weekFromISO } = warsawDayBoundsISO(weekStart);



      const [spine, checkpoints, pinsRes, projectsData, kpisRes, dailyWinsRes, focusRes, skillsRes, linksRes, todosRes, sectionsRes, doneCpsRes, dueCpsRes] =

        await Promise.all([

        fetchGoalSpine(userId, weekStart),

        fetchUpcomingCheckpoints(userId, 14),

        supabase

          .from('learning_week_pins')

          .select('id, slot, done, entity_type, entity_id, manual_title, project_id')

          .eq('user_id', userId)

          .eq('week_start', weekStart)

          .order('sort_order'),

        fetchActiveProjects(userId),

        supabase.from('goal_kpis').select('id, project_id, name, target').eq('user_id', userId),

        supabase

          .from('daily_wins')

          .select('date, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5')

          .eq('user_id', userId)

          .gte('date', weekStart)

          .lt('date', weekEnd),

        supabase

          .from('learning_week_focus')

          .select('skill_id, subskill_id, target_level')

          .eq('user_id', userId)

          .eq('week_start', weekStart)

          .maybeSingle(),

        supabase

          .from('learning_skills')

          .select('id, key, label, parent_id')

          .eq('user_id', userId)

          .eq('active', true),

        supabase

          .from('vanguard_links')

          .select('id, title')

          .eq('user_id', userId)

          .limit(80),

        supabase

          .from('todo_items')

          .select('id, title, priority, due_date, section_id, status')

          .eq('user_id', userId)

          .neq('status', 'done')

          .order('created_at', { ascending: false })

          .limit(60),

        supabase.from('todo_sections').select('id, project_id').eq('user_id', userId),

        supabase

          .from('todo_items')

          .select('id', { count: 'exact', head: true })

          .eq('user_id', userId)

          .eq('is_milestone', true)

          .eq('status', 'done')

          .gte('completed_at', weekFromISO),

        supabase

          .from('todo_items')

          .select('id', { count: 'exact', head: true })

          .eq('user_id', userId)

          .eq('is_milestone', true)

          .in('status', ['pending', 'open'])

          .lte('due_date', weekEnd),

      ]);



      const overdue = checkpoints.filter((cp) => cp.isOverdue);

      const upcoming = checkpoints.filter((cp) => !cp.isOverdue);



      const linksMap = new Map((linksRes.data ?? []).map((l) => [l.id, l]));

      const todosMap = new Map((todosRes.data ?? []).map((t) => [t.id, t]));

      const sectionProject = new Map((sectionsRes.data ?? []).map((s) => [s.id, s.project_id]));



      const mustPins: DirectionMustPin[] = (pinsRes.data ?? []).map((p) => ({

        id: p.id,

        title: resolvePinTitle(p, linksMap, todosMap),

        projectId: p.project_id,

        done: !!p.done,

        slot: p.slot as 'must' | 'active',

      }));



      const openMustPins = mustPins.filter((p) => p.slot === 'must' && !p.done);



      const urgentTodos: DirectionUrgentTodo[] = (todosRes.data ?? [])

        .filter((t) => t.priority === 'urgent' || t.priority === 'high')

        .map((t) => {

          const projectId = t.section_id ? sectionProject.get(t.section_id) ?? null : null;

          const project = projectsData.find((p) => p.id === projectId);

          return {

            id: t.id,

            title: t.title,

            priority: t.priority ?? 'normal',

            due_date: t.due_date,

            projectId: projectId ?? null,

            projectName: project?.name ?? null,

          };

        })

        .slice(0, 8);



      const allKpis = kpisRes.data ?? [];
      const latestKpiValues = await fetchLatestKpiValues(userId, allKpis.map((k) => k.id));

      const activeProjects: DirectionProjectSummary[] = projectsData.map((p) => ({

        id: p.id,

        name: p.name,

        goal: p.goal,

        primarySkillId: p.primary_skill_id ?? null,

        kpis: allKpis

          .filter((k) => k.project_id === p.id)

          .map((k) => ({

            id: k.id,

            name: k.name ?? 'KPI',

            current: latestKpiValues.get(k.id) ?? null,

            target: k.target ?? null,

          })),

      }));

      const skills = (skillsRes.data ?? []).map((s) => ({ id: s.id, label: s.label, key: s.key }));

      const skillsById = new Map(skills.map((s) => [s.id, s]));

      const subskill = focusRes.data?.subskill_id

        ? skillsRes.data?.find((s) => s.id === focusRes.data?.subskill_id)

        : null;

      const parentSkill = focusRes.data?.skill_id

        ? skillsById.get(focusRes.data.skill_id)

        : null;



      const focus: DirectionFocus = {

        skillId: focusRes.data?.skill_id ?? null,

        skillLabel: parentSkill?.label ?? null,

        subskillLabel: subskill?.label ?? null,

        targetLevel: focusRes.data?.target_level ?? null,

      };



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



      setData({

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

      });

    } catch (e: unknown) {

      console.error('[useDirectionContext]', e);

      setData(null);

    } finally {

      setLoading(false);

    }

  }, [userId, weekStart]);



  useEffect(() => {

    void (async () => { await reload(); })();

  }, [reload]);



  useGoalSpineInvalidation(reload);



  const checkpoints = data?.checkpoints ?? EMPTY_CHECKPOINTS;



  return useMemo(

    () => ({

      weekStart: data?.weekStart ?? weekStart,

      weekGoals: data?.weekGoals,

      weekGoalsMeta: data?.weekGoalsMeta,

      mustPins: data?.mustPins,

      openMustPins: data?.openMustPins,

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

    [data, weekStart, checkpoints, loading, reload],

  );

}


