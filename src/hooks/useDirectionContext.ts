import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchUpcomingCheckpoints } from '../lib/checkpoints';
import { getTodayWarsaw, warsawDayBoundsISO } from '../lib/date';
import { getWeekStartWarsaw } from '../lib/growth';
import { getSprintInfo } from '../components/desktop/desktopUtils';
import {
  computePowerListWeekStats,
  getWeekEndExclusive,
  type WeekDirectionGoals,
} from '../lib/growthWeek';
import { supabase } from '../lib/supabase';
import type {
  DirectionContextData,
  DirectionFocus,
  DirectionMustPin,
  DirectionProjectSummary,
  DirectionUrgentTodo,
} from '../lib/dailyPlanProposal';

export type { DirectionContextData, DirectionMustPin, DirectionUrgentTodo, DirectionProjectSummary, DirectionFocus };

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

export function useDirectionContext(userId: string | undefined, weekStartOverride?: string) {
  const weekStart = weekStartOverride ?? getWeekStartWarsaw(getTodayWarsaw());
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
      const sprint = getSprintInfo();
      const weekEnd = getWeekEndExclusive(weekStart);
      const { fromISO: weekFromISO } = warsawDayBoundsISO(weekStart);

      const [
        checkpoints,
        reviewRes,
        pinsRes,
        projectsRes,
        kpisRes,
        dailyWinsRes,
        sprintRes,
        focusRes,
        skillsRes,
        linksRes,
        todosRes,
        sectionsRes,
        doneCpsRes,
        dueCpsRes,
      ] = await Promise.all([
        fetchUpcomingCheckpoints(userId, 14),
        supabase
          .from('weekly_reviews')
          .select('week_intention, week_commitment, week_goal_cialo, week_goal_duch, week_goal_konto')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .maybeSingle(),
        supabase
          .from('learning_week_pins')
          .select('id, slot, done, entity_type, entity_id, manual_title, project_id')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .order('sort_order'),
        supabase
          .from('projects')
          .select('id, name, goal, status, primary_skill_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase.from('goal_kpis').select('id, project_id, name, current_value, target').eq('user_id', userId),
        supabase
          .from('daily_wins')
          .select('date, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5')
          .eq('user_id', userId)
          .gte('date', weekStart)
          .lt('date', weekEnd),
        supabase
          .from('sprint_goals')
          .select('goal_text')
          .eq('user_id', userId)
          .eq('personal_year', sprint.personalYear)
          .eq('sprint_number', sprint.sprintNumber)
          .maybeSingle(),
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
          .from('project_checkpoints')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'done')
          .gte('completed_at', weekFromISO),
        supabase
          .from('project_checkpoints')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
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
          const project = (projectsRes.data ?? []).find((p) => p.id === projectId);
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
      const activeProjects: DirectionProjectSummary[] = (projectsRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        goal: p.goal,
        primarySkillId: p.primary_skill_id ?? null,
        kpis: allKpis
          .filter((k) => k.project_id === p.id)
          .map((k) => ({
            id: k.id,
            name: k.name ?? 'KPI',
            current: k.current_value ?? null,
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

      let review = reviewRes.data;
      if (!review?.week_intention && !review?.week_goal_cialo) {
        const { data: fallback } = await supabase
          .from('weekly_reviews')
          .select('week_intention, week_commitment, week_goal_cialo, week_goal_duch, week_goal_konto')
          .eq('user_id', userId)
          .or('week_intention.not.is.null,week_goal_cialo.not.is.null')
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallback) review = fallback;
      }

      const weekGoals: WeekDirectionGoals = {
        intention: review?.week_intention ?? null,
        commitment: review?.week_commitment ?? null,
        cialo: review?.week_goal_cialo ?? null,
        duch: review?.week_goal_duch ?? null,
        konto: review?.week_goal_konto ?? null,
      };

      const powerListStats = computePowerListWeekStats(dailyWinsRes.data ?? []);

      setData({
        weekStart,
        weekGoals,
        checkpoints: { all: checkpoints, overdue, upcoming },
        mustPins,
        openMustPins,
        urgentTodos,
        activeProjects,
        powerListStats,
        sprintGoal: sprintRes.data?.goal_text ?? null,
        sprintLabel: `Sprint ${sprint.sprintNumber}`,
        focus,
        weekCheckpointsDone: doneCpsRes.count ?? 0,
        weekCheckpointsDue: dueCpsRes.count ?? 0,
        skills,
      });
    } catch (e) {
      console.error('[useDirectionContext]', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const checkpoints = data?.checkpoints ?? { all: [], overdue: [], upcoming: [] };

  return {
    ...data,
    checkpoints,
    loading,
    reload,
  };
}
