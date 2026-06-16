import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type GoalKey = 'cialo' | 'duch' | 'konto';

export interface DailyPushSuggestion {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  dreamTitle: string;
  goalKey: GoalKey;
  reason: string;
}

const GOAL_LABELS: Record<GoalKey, string> = {
  cialo: 'Ciało',
  duch: 'Duch',
  konto: 'Konto',
};

export function useDailyPush(userId: string | undefined): DailyPushSuggestion | null {
  const [suggestion, setSuggestion] = useState<DailyPushSuggestion | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const weekStartStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

        const [dreamsRes, projectsRes, sectionsRes, openItemsRes, doneItemsRes, weeklyRes] =
          await Promise.all([
            supabase
              .from('dreams')
              .select('id, title, life_goal')
              .eq('user_id', userId)
              .eq('is_done', false)
              .not('life_goal', 'is', null),
            supabase
              .from('projects')
              .select('id, name, color, dream_id')
              .eq('user_id', userId)
              .eq('status', 'active'),
            supabase
              .from('todo_sections')
              .select('id, project_id')
              .eq('user_id', userId),
            supabase
              .from('todo_items')
              .select('id, title, section_id, sort_order')
              .eq('user_id', userId)
              .eq('status', 'open')
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true }),
            supabase
              .from('todo_items')
              .select('section_id')
              .eq('user_id', userId)
              .eq('status', 'done')
              .gte('updated_at', sevenDaysAgo.toISOString()),
            supabase
              .from('weekly_reviews')
              .select('focus_goal_mappings')
              .eq('user_id', userId)
              .eq('week_start', weekStartStr)
              .maybeSingle(),
          ]);

        if (cancelled) return;

        const dreams = dreamsRes.data ?? [];
        const projects = projectsRes.data ?? [];
        const sections = sectionsRes.data ?? [];
        const openItems = openItemsRes.data ?? [];
        const doneItems = doneItemsRes.data ?? [];
        const focusMappings = weeklyRes.data?.focus_goal_mappings as Record<string, string> | null;

        const dreamById = Object.fromEntries(dreams.map(d => [d.id, d]));
        const sectionById = Object.fromEntries(sections.map(s => [s.id, s]));

        // Open tasks grouped by project
        const openByProject: Record<string, typeof openItems> = {};
        for (const item of openItems) {
          const sec = sectionById[item.section_id ?? ''] as any;
          if (!sec?.project_id) continue;
          (openByProject[sec.project_id] ??= []).push(item);
        }

        // Done tasks this week grouped by project
        const doneCountByProject: Record<string, number> = {};
        for (const item of doneItems) {
          const sec = sectionById[item.section_id ?? ''] as any;
          if (!sec?.project_id) continue;
          doneCountByProject[sec.project_id] = (doneCountByProject[sec.project_id] ?? 0) + 1;
        }

        // Which life goals had focus tasks declared this week
        const weekFocusByGoal: Record<string, number> = {};
        if (focusMappings) {
          for (const val of Object.values(focusMappings)) {
            const key = (val as string).replace('goal_', '');
            weekFocusByGoal[key] = (weekFocusByGoal[key] ?? 0) + 1;
          }
        }

        interface Candidate {
          project: (typeof projects)[0];
          dream: (typeof dreams)[0];
          firstTask: (typeof openItems)[0];
          score: number;
          reason: string;
        }

        const candidates: Candidate[] = [];

        for (const project of projects) {
          if (!project.dream_id) continue;
          const dream = dreamById[project.dream_id];
          if (!dream?.life_goal) continue;

          const projectOpen = openByProject[project.id] ?? [];
          if (projectOpen.length === 0) continue;

          const goalKey = dream.life_goal as GoalKey;
          const doneThisWeek = doneCountByProject[project.id] ?? 0;
          const focusForGoal = weekFocusByGoal[goalKey] ?? 0;

          let score = 10; // base: full chain exists
          let reason = '';

          // Neglect: no movement in this project this week
          if (doneThisWeek === 0) {
            score += 8;
            reason = 'Żadnego ruchu w tym tygodniu';
          } else if (doneThisWeek <= 2) {
            score += 3;
            reason = `Tylko ${doneThisWeek} ${doneThisWeek === 1 ? 'zadanie' : 'zadania'} ten tydzień`;
          } else {
            reason = `${doneThisWeek} zadań ukończonych ten tydzień`;
          }

          // Balance: neglected life goal this week
          if (focusForGoal === 0) {
            score += 5;
            reason = reason || `${GOAL_LABELS[goalKey]} bez uwagi w tym tygodniu`;
          } else if (focusForGoal <= 2) {
            score += 2;
          }

          // Open tasks available (momentum potential)
          score += Math.min(projectOpen.length, 5);

          candidates.push({
            project,
            dream,
            firstTask: projectOpen[0],
            score,
            reason: reason || `Następny krok → ${dream.title}`,
          });
        }

        if (cancelled || candidates.length === 0) {
          setSuggestion(null);
          return;
        }

        candidates.sort((a, b) => b.score - a.score);
        const w = candidates[0];

        setSuggestion({
          taskId: w.firstTask.id,
          taskTitle: w.firstTask.title,
          projectId: w.project.id,
          projectName: w.project.name,
          projectColor: w.project.color,
          dreamTitle: w.dream.title,
          goalKey: w.dream.life_goal as GoalKey,
          reason: w.reason,
        });
      } catch (err) {
        console.error('[useDailyPush] error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return suggestion;
}
