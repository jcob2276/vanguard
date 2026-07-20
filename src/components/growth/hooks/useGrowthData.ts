import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  partitionSkillTree,
  type LearningSkill,
  type LearningSkillSnapshot,
  type LearningWeekFocus,
  type LearningWeekPin,
} from '../../../lib/growth/growth';
import { insertDefaultSkillTree } from '../../../lib/growth/growthSeed';
import { fetchGoalSpine, fetchLatestKpiValues } from '../../../lib/goal/goalSpine';
import { useGoalSpineInvalidation } from '../../../hooks/useGoalSpineInvalidation';
import { warsawDayBoundsISO } from '../../../lib/date';
import {
  computePowerListWeekStats,
  focusScoreForWeek,
  getWeekEndExclusive,
  type GrowthPrevWeekSummary,
  type PowerListWeekStats,
  type WeekDirectionGoals,
} from '../../../lib/growth/growthWeek';
import { fetchGrowthPrevWeekSummary } from './useGrowthWeekRecap';

import type { GrowthLinkRow, GrowthWeekNote, GrowthTodoRow, GrowthProjectSummary, VanguardIdentityData } from '../../../lib/growth/growth.types';
export type { GrowthLinkRow, GrowthWeekNote, GrowthTodoRow, GrowthProjectSummary, VanguardIdentityData } from '../../../lib/growth/growth.types';

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

export interface GrowthCheckpoint {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  due_date: string;
  status: string;
  daysOverdue: number; // negative = upcoming, positive = overdue
}

export interface GrowthDataResult {
  skills: LearningSkill[];
  snapshots: LearningSkillSnapshot[];
  focus: LearningWeekFocus | null;
  pins: LearningWeekPin[];
  unreadLinks: GrowthLinkRow[];
  readLinks: GrowthLinkRow[];
  openTodos: GrowthTodoRow[];
  context: GrowthContextData;
  rozwojNotesCount: number;
  weekNotes: GrowthWeekNote[];
  powerListStats: PowerListWeekStats;
  prevWeekSummary: GrowthPrevWeekSummary | null;
  weekFocusScore: number | null;
  activeProjects: GrowthProjectSummary[];
  upcomingCheckpoints: GrowthCheckpoint[];
  identity: VanguardIdentityData | null;
}

export function useGrowthData(userId: string | undefined, weekStart: string) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['growth-data', userId, weekStart], [userId, weekStart]);

  const query = useQuery<GrowthDataResult | null>({
    queryKey,
    queryFn: async () => {
      if (!userId) return null;

      // Ensure default skills exist
      const { data: existing } = await supabase
        .from('learning_skills')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1);
      if (!existing || existing.length === 0) {
        await insertDefaultSkillTree(supabase, userId);
      }

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
        spine,
        projectsRes,
        kpisRes,
        rozwojNotesRes,
        dailyWinsRes,
        checkpointsRes,
        prevWeekRes,
        identityRes,
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
        fetchGoalSpine(userId, weekStart),
        supabase
          .from('projects')
          .select('id, name, goal, status, primary_skill_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
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
          .select('task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5, date, daily_win_tasks(slot, title, done)')
          .eq('user_id', userId)
          .gte('date', weekStart)
          .lt('date', weekEnd),
        supabase
          .from('todo_items')
          .select('id, project_id, title, due_date, status')
          .eq('user_id', userId)
          .eq('is_milestone', true)
          .in('status', ['pending', 'open'])
          .order('due_date', { ascending: true })
          .limit(10),
        fetchGrowthPrevWeekSummary(userId, weekStart),
        supabase
          .from('vanguard_identity')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const skills = (((skillsRes.data as LearningSkill[]) ?? []).map((s) => ({
        ...s,
        parent_id: s.parent_id ?? null,
      })));
      const snapshots = ((snapshotsRes.data ?? []).map((r) => ({
        id: r.id,
        snapshot_date: r.snapshot_date,
        scores: (r.scores as Record<string, number>) ?? {},
      })));
      const focus = (focusRes.data as LearningWeekFocus | null) ?? null;
      const pins = (pinsRes.data as LearningWeekPin[]) ?? [];
      const unreadLinks = (unreadRes.data as GrowthLinkRow[]) ?? [];
      const readLinks = (readRes.data as GrowthLinkRow[]) ?? [];
      const openTodos = (todosRes.data as GrowthTodoRow[]) ?? [];

      const activeProjectRows = projectsRes.data ?? [];
      const allKpis = (kpisRes.data ?? []) as {
        id: string;
        project_id?: string | null;
        name?: string;
        target?: number | null;
      }[];
      const latestKpiValues = await fetchLatestKpiValues(userId, allKpis.map((k) => k.id));

      const activeProjects: GrowthProjectSummary[] = activeProjectRows.map((p) => ({
        id: p.id,
        name: p.name,
        goal: p.goal ?? null,
        status: p.status,
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

      // Build upcoming/overdue checkpoints
      const todayStr = weekStart; // use current date context
      const checkpointRowsRaw = (checkpointsRes.data ?? []) as { id: string; project_id: string | null; title: string; due_date: string | null; status: string }[];
      const checkpointRows = checkpointRowsRaw.filter(
        (cp): cp is typeof cp & { project_id: string; due_date: string } =>
          cp.project_id != null && cp.due_date != null
      );
      const projNameMap = new Map(activeProjectRows.map((p) => [p.id, p.name]));
      const upcomingCheckpoints: GrowthCheckpoint[] = checkpointRows
        .filter((cp) => projNameMap.has(cp.project_id))
        .map((cp) => {
          const diffMs = new Date(cp.due_date).getTime() - new Date(todayStr).getTime();
          const daysOverdue = -Math.round(diffMs / (1000 * 60 * 60 * 24));
          return {
            id: cp.id,
            project_id: cp.project_id,
            project_name: projNameMap.get(cp.project_id) ?? '',
            title: cp.title,
            due_date: cp.due_date,
            status: cp.status,
            daysOverdue,
          };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue); // overdue first

      const activeProject = activeProjectRows[0] ?? null;
      const projectKpis = allKpis.filter((k) => k.project_id === activeProject?.id);
      const firstKpi = projectKpis[0];

      const weekResolved = spine.week;
      const sprint = spine.sprint;

      const weekGoals: WeekDirectionGoals = {
        intention: weekResolved.intention,
        commitment: weekResolved.commitment,
        cialo: weekResolved.cialo,
        duch: weekResolved.duch,
        konto: weekResolved.konto,
      };

      const context: GrowthContextData = {
        weekIntention: weekGoals.intention || weekGoals.commitment || null,
        weekCommitment: weekGoals.commitment,
        weekGoals,
        sprintGoal: sprint.goalText,
        sprintLabel: sprint.label,
        activeProjectName: activeProject?.name ?? null,
        kpiName: firstKpi?.name || null,
        kpiValue: firstKpi ? latestKpiValues.get(firstKpi.id) ?? null : null,
        kpiTarget: firstKpi?.target ?? null,
        kpiId: firstKpi?.id ?? null,
      };

      const weekNotes = (rozwojNotesRes.data as GrowthWeekNote[]) ?? [];
      const notesCount = weekNotes.length;
      const powerListStats = computePowerListWeekStats(dailyWinsRes.data ?? []);
      const prevWeekSummary = prevWeekRes;

      const { parents } = partitionSkillTree(skills);
      const snapRows = snapshots.map((r) => ({
        snapshot_date: r.snapshot_date,
        scores: r.scores,
      }));
      const weekFocusScore = focusScoreForWeek(parents, snapRows, weekStart, focus);

      return {
        skills,
        snapshots,
        focus,
        pins,
        unreadLinks,
        readLinks,
        openTodos,
        context,
        rozwojNotesCount: notesCount,
        weekNotes,
        powerListStats,
        prevWeekSummary,
        weekFocusScore,
        activeProjects,
        upcomingCheckpoints,
        identity: (identityRes.data as VanguardIdentityData | null) ?? null,
      };
    },
    enabled: !!userId,
  });

  const skills = useMemo(() => query.data?.skills ?? [], [query.data?.skills]);
  const snapshots = useMemo(() => query.data?.snapshots ?? [], [query.data?.snapshots]);
  const focus = query.data?.focus ?? null;
  const pins = useMemo(() => query.data?.pins ?? [], [query.data?.pins]);
  const unreadLinks = useMemo(() => query.data?.unreadLinks ?? [], [query.data?.unreadLinks]);
  const readLinks = useMemo(() => query.data?.readLinks ?? [], [query.data?.readLinks]);
  const openTodos = useMemo(() => query.data?.openTodos ?? [], [query.data?.openTodos]);
  const context = useMemo(() => query.data?.context ?? {
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
  }, [query.data?.context]);
  const loading = query.isLoading;
  const notesCount = query.data?.rozwojNotesCount ?? 0;
  const powerListStats = useMemo(() => query.data?.powerListStats ?? {
    daysLogged: 0,
    daysWithWins: 0,
    tasksDone: 0,
    tasksSet: 0,
  }, [query.data?.powerListStats]);
  const prevWeekSummary = query.data?.prevWeekSummary ?? null;
  const weekFocusScore = query.data?.weekFocusScore ?? null;
  const activeProjects = useMemo(() => query.data?.activeProjects ?? [], [query.data?.activeProjects]);
  const weekNotes = useMemo(() => query.data?.weekNotes ?? [], [query.data?.weekNotes]);
  const upcomingCheckpoints = useMemo(() => query.data?.upcomingCheckpoints ?? [], [query.data?.upcomingCheckpoints]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  useGoalSpineInvalidation(refresh);

  const setFocus = useCallback((updater: LearningWeekFocus | null | ((prev: LearningWeekFocus | null) => LearningWeekFocus | null)) => {
    queryClient.setQueryData<GrowthDataResult | null>(queryKey, (old) => {
      if (!old) return old;
      const nextFocus = typeof updater === 'function' ? updater(old.focus) : updater;
      return { ...old, focus: nextFocus };
    });
  }, [queryClient, queryKey]);

  const setPins = useCallback((updater: LearningWeekPin[] | ((prev: LearningWeekPin[]) => LearningWeekPin[])) => {
    queryClient.setQueryData<GrowthDataResult | null>(queryKey, (old) => {
      if (!old) return old;
      const nextPins = typeof updater === 'function' ? updater(old.pins) : updater;
      return { ...old, pins: nextPins };
    });
  }, [queryClient, queryKey]);

  const setSkills = useCallback((updater: LearningSkill[] | ((prev: LearningSkill[]) => LearningSkill[])) => {
    queryClient.setQueryData<GrowthDataResult | null>(queryKey, (old) => {
      if (!old) return old;
      const nextSkills = typeof updater === 'function' ? updater(old.skills) : updater;
      return { ...old, skills: nextSkills };
    });
  }, [queryClient, queryKey]);

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
    rozwojNotesCount: notesCount,
    powerListStats,
    prevWeekSummary,
    weekFocusScore,
    activeProjects,
    weekNotes,
    refresh,
    setFocus,
    setPins,
    setSkills,
    upcomingCheckpoints,
    identity: query.data?.identity ?? null,
  };
}

