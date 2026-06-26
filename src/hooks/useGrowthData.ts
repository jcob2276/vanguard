import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  getWeekStartWarsaw,
  partitionSkillTree,
  type LearningSkill,
  type LearningSkillSnapshot,
  type LearningWeekFocus,
  type LearningWeekPin,
} from '../lib/growth';
import { insertDefaultSkillTree } from '../lib/growthSeed';
import { getSprintInfo } from '../components/desktop/desktopUtils';
import { warsawDayBoundsISO } from '../lib/date';
import {
  computePowerListWeekStats,
  focusScoreForWeek,
  getWeekEndExclusive,
  type GrowthPrevWeekSummary,
  type PowerListWeekStats,
  type WeekDirectionGoals,
} from '../lib/growthWeek';
import { fetchGrowthPrevWeekSummary } from './useGrowthWeekRecap';

export interface GrowthLinkRow {
  id: string;
  url: string;
  title: string;
  status: string;
  category: string;
  resource_type: string | null;
  thumbnail_url: string | null;
  domain: string;
  updated_at?: string | null;
}

export interface GrowthWeekNote {
  id: string;
  title: string;
  created_at: string;
}

export interface GrowthTodoRow {
  id: string;
  title: string;
  status: string;
}

export interface GrowthContextData {
  weekIntention: string | null;
  weekCommitment: string | null;
  weekGoals: WeekDirectionGoals;
  sprintGoal: string | null;
  sprintLabel: string | null;
  activeProjectName: string | null;
  kpiName: string | null;
  kpiValue: number | null;
  kpiTarget: number | null;
  kpiId: string | null;
}

export interface GrowthProjectSummary {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  kpis: { id: string; name: string; current: number | null; target: number | null }[];
}

export function useGrowthData(userId: string | undefined, weekStart: string) {
  const [skills, setSkills] = useState<LearningSkill[]>([]);
  const [snapshots, setSnapshots] = useState<LearningSkillSnapshot[]>([]);
  const [focus, setFocus] = useState<LearningWeekFocus | null>(null);
  const [pins, setPins] = useState<LearningWeekPin[]>([]);
  const [unreadLinks, setUnreadLinks] = useState<GrowthLinkRow[]>([]);
  const [readLinks, setReadLinks] = useState<GrowthLinkRow[]>([]);
  const [openTodos, setOpenTodos] = useState<GrowthTodoRow[]>([]);
  const [context, setContext] = useState<GrowthContextData>({
    weekIntention: null,
    weekCommitment: null,
    weekGoals: { intention: null, commitment: null, cialo: null, duch: null, konto: null },
    sprintGoal: null,
    sprintLabel: null,
    activeProjectName: null,
    kpiName: null,
    kpiValue: null,
    kpiTarget: null,
    kpiId: null,
  });
  const [powerListStats, setPowerListStats] = useState<PowerListWeekStats>({
    daysLogged: 0,
    daysWithWins: 0,
    tasksDone: 0,
    tasksSet: 0,
  });
  const [prevWeekSummary, setPrevWeekSummary] = useState<GrowthPrevWeekSummary | null>(null);
  const [weekFocusScore, setWeekFocusScore] = useState<number | null>(null);
  const [activeProjects, setActiveProjects] = useState<GrowthProjectSummary[]>([]);
  const [weekNotes, setWeekNotes] = useState<GrowthWeekNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [rozwojNotesCount, setRozwojNotesCount] = useState(0);

  const ensureDefaultSkills = useCallback(async () => {
    if (!userId) return;
    const { data: existing } = await supabase
      .from('learning_skills')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (existing && existing.length > 0) return;

    await insertDefaultSkillTree(supabase, userId);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await ensureDefaultSkills();

      const sprint = getSprintInfo();
      const { fromISO: weekFromISO } = warsawDayBoundsISO(weekStart);

      const weekEnd = getWeekEndExclusive(weekStart);

      const [
        skillsRes,
        snapshotsRes,
        focusRes,
        pinsRes,
        unreadRes,
        readRes,
        todosRes,
        reviewRes,
        sprintRes,
        projectsRes,
        kpisRes,
        rozwojNotesRes,
        dailyWinsRes,
        prevWeekRes,
      ] = await Promise.all([
        supabase
          .from('learning_skills')
          .select('*')
          .eq('user_id', userId)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('learning_skill_snapshots')
          .select('id, snapshot_date, scores')
          .eq('user_id', userId)
          .order('snapshot_date', { ascending: false })
          .limit(24),
        supabase
          .from('learning_week_focus')
          .select(
            'week_start, skill_id, subskill_id, why_text, drill_text, target_level, rep_target, rep_done, lateral_challenge, vertical_challenge',
          )
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .maybeSingle(),
        supabase
          .from('learning_week_pins')
          .select('*')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .order('slot')
          .order('sort_order'),
        supabase
          .from('vanguard_links')
          .select('id, url, title, status, category, resource_type, thumbnail_url, domain')
          .eq('user_id', userId)
          .eq('status', 'unread')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('vanguard_links')
          .select('id, url, title, status, category, resource_type, thumbnail_url, domain, updated_at')
          .eq('user_id', userId)
          .eq('status', 'read')
          .order('updated_at', { ascending: false })
          .limit(40),
        supabase
          .from('todo_items')
          .select('id, title, status')
          .eq('user_id', userId)
          .neq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('weekly_reviews')
          .select('week_intention, week_commitment, week_goal_cialo, week_goal_duch, week_goal_konto')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .maybeSingle(),
        supabase
          .from('sprint_goals')
          .select('goal_text')
          .eq('user_id', userId)
          .eq('personal_year', sprint.personalYear)
          .eq('sprint_number', sprint.sprintNumber)
          .maybeSingle(),
        supabase
          .from('projects')
          .select('id, name, goal, status')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(24),
        supabase.from('goal_kpis').select('*').eq('user_id', userId).order('sort_order'),
        supabase
          .from('vanguard_notes')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .contains('tags', ['rozwoj'])
          .gte('created_at', weekFromISO)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('daily_wins')
          .select('task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5, date')
          .eq('user_id', userId)
          .gte('date', weekStart)
          .lt('date', weekEnd),
        fetchGrowthPrevWeekSummary(userId, weekStart),
      ]);

      setSkills(
        ((skillsRes.data as LearningSkill[]) ?? []).map((s) => ({
          ...s,
          parent_id: s.parent_id ?? null,
        })),
      );
      setSnapshots(
        (snapshotsRes.data ?? []).map((r) => ({
          id: r.id,
          snapshot_date: r.snapshot_date,
          scores: (r.scores as Record<string, number>) ?? {},
        })),
      );
      setFocus((focusRes.data as LearningWeekFocus | null) ?? null);
      setPins((pinsRes.data as LearningWeekPin[]) ?? []);
      setUnreadLinks((unreadRes.data as GrowthLinkRow[]) ?? []);
      setReadLinks((readRes.data as GrowthLinkRow[]) ?? []);
      setOpenTodos((todosRes.data as GrowthTodoRow[]) ?? []);

      const activeProjectRows = projectsRes.data ?? [];
      const allKpis = (kpisRes.data ?? []) as {
        id: string;
        project_id?: string | null;
        name?: string;
        current_value?: number | null;
        target?: number | null;
      }[];

      const projectSummaries: GrowthProjectSummary[] = activeProjectRows.map((p) => ({
        id: p.id,
        name: p.name,
        goal: p.goal ?? null,
        status: p.status,
        kpis: allKpis
          .filter((k) => k.project_id === p.id)
          .map((k) => ({
            id: k.id,
            name: k.name ?? 'KPI',
            current: k.current_value ?? null,
            target: k.target ?? null,
          })),
      }));
      setActiveProjects(projectSummaries);

      const activeProject = activeProjectRows[0] ?? null;
      const projectKpis = allKpis.filter((k) => k.project_id === activeProject?.id);
      const firstKpi = projectKpis[0];

      const review = reviewRes.data;
      const weekGoals: WeekDirectionGoals = {
        intention: review?.week_intention ?? null,
        commitment: review?.week_commitment ?? null,
        cialo: review?.week_goal_cialo ?? null,
        duch: review?.week_goal_duch ?? null,
        konto: review?.week_goal_konto ?? null,
      };

      setContext({
        weekIntention: weekGoals.intention || weekGoals.commitment || null,
        weekCommitment: weekGoals.commitment,
        weekGoals,
        sprintGoal: sprintRes.data?.goal_text ?? null,
        sprintLabel: `Sprint ${sprint.sprintNumber}`,
        activeProjectName: activeProject?.name ?? null,
        kpiName: firstKpi?.name || null,
        kpiValue: firstKpi?.current_value ?? null,
        kpiTarget: firstKpi?.target ?? null,
        kpiId: firstKpi?.id ?? null,
      });
      setRozwojNotesCount((rozwojNotesRes.data ?? []).length);
      setWeekNotes((rozwojNotesRes.data as GrowthWeekNote[]) ?? []);
      setPowerListStats(computePowerListWeekStats(dailyWinsRes.data ?? []));
      setPrevWeekSummary(prevWeekRes);

      const loadedSkills = ((skillsRes.data as LearningSkill[]) ?? []).map((s) => ({
        ...s,
        parent_id: s.parent_id ?? null,
      }));
      const { parents } = partitionSkillTree(loadedSkills);
      const snapRows = (snapshotsRes.data ?? []).map((r) => ({
        snapshot_date: r.snapshot_date as string,
        scores: (r.scores as Record<string, number>) ?? {},
      }));
      setWeekFocusScore(focusScoreForWeek(parents, snapRows, weekStart, focusRes.data));
    } catch (err) {
      console.error('[useGrowthData] refresh failed', err);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, ensureDefaultSkills]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    skills,
    snapshots,
    focus,
    pins,
    unreadLinks,
    readLinks,
    openTodos,
    context,
    loading,
    rozwojNotesCount,
    powerListStats,
    prevWeekSummary,
    weekFocusScore,
    activeProjects,
    weekNotes,
    refresh,
    setFocus,
    setPins,
    setSkills,
  };
}
