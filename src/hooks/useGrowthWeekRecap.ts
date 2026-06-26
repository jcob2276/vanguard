import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { partitionSkillTree, type LearningSkill } from '../lib/growth';
import {
  focusScoreForWeek,
  summarizePins,
  type GrowthPrevWeekSummary,
} from '../lib/growthWeek';
import { shiftWeekStart } from '../lib/growth';
import { warsawDayBoundsISO } from '../lib/date';

export interface GrowthWeekRecap {
  weekStart: string;
  focusSkillLabel: string | null;
  focusTarget: number | null;
  focusWhy: string | null;
  mustDone: number;
  mustTotal: number;
  activeDone: number;
  activeTotal: number;
  notesCount: number;
  focusScore: number | null;
  loading: boolean;
}

export function useGrowthWeekRecap(userId: string | undefined, weekStart: string) {
  const [recap, setRecap] = useState<GrowthWeekRecap>({
    weekStart,
    focusSkillLabel: null,
    focusTarget: null,
    focusWhy: null,
    mustDone: 0,
    mustTotal: 0,
    activeDone: 0,
    activeTotal: 0,
    notesCount: 0,
    focusScore: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setRecap((r) => ({ ...r, loading: true, weekStart }));
    try {
      const { fromISO: weekFromISO } = warsawDayBoundsISO(weekStart);
      const [skillsRes, focusRes, pinsRes, snapshotsRes, notesRes] = await Promise.all([
        supabase.from('learning_skills').select('*').eq('user_id', userId).eq('active', true),
        supabase
          .from('learning_week_focus')
          .select('skill_id, why_text, target_level')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .maybeSingle(),
        supabase.from('learning_week_pins').select('slot, done').eq('user_id', userId).eq('week_start', weekStart),
        supabase
          .from('learning_skill_snapshots')
          .select('snapshot_date, scores')
          .eq('user_id', userId)
          .order('snapshot_date', { ascending: false })
          .limit(12),
        supabase
          .from('vanguard_notes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .contains('tags', ['rozwoj'])
          .gte('created_at', weekFromISO),
      ]);

      const skills = ((skillsRes.data ?? []) as LearningSkill[]).map((s) => ({
        ...s,
        parent_id: s.parent_id ?? null,
      }));
      const { parents } = partitionSkillTree(skills);
      const focus = focusRes.data;
      const focusSkill = parents.find((s) => s.id === focus?.skill_id);
      const pinStats = summarizePins((pinsRes.data ?? []) as { slot: string; done: boolean }[]);
      const snapshots = (snapshotsRes.data ?? []).map((s) => ({
        snapshot_date: s.snapshot_date as string,
        scores: (s.scores as Record<string, number>) ?? {},
      }));

      setRecap({
        weekStart,
        focusSkillLabel: focusSkill?.label ?? null,
        focusTarget: focus?.target_level ?? null,
        focusWhy: focus?.why_text ?? null,
        ...pinStats,
        notesCount: notesRes.count ?? 0,
        focusScore: focusScoreForWeek(parents, snapshots, weekStart, focus),
        loading: false,
      });
    } catch (e) {
      console.error('[useGrowthWeekRecap]', e);
      setRecap((r) => ({ ...r, loading: false }));
    }
  }, [userId, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  return { recap, refresh: load };
}

export async function fetchGrowthPrevWeekSummary(
  userId: string,
  weekStart: string,
): Promise<GrowthPrevWeekSummary | null> {
  const prevStart = shiftWeekStart(weekStart, -1);
  const [skillsRes, focusRes, pinsRes, snapshotsRes] = await Promise.all([
    supabase.from('learning_skills').select('*').eq('user_id', userId).eq('active', true),
    supabase
      .from('learning_week_focus')
      .select('skill_id, target_level')
      .eq('user_id', userId)
      .eq('week_start', prevStart)
      .maybeSingle(),
    supabase.from('learning_week_pins').select('slot, done').eq('user_id', userId).eq('week_start', prevStart),
    supabase
      .from('learning_skill_snapshots')
      .select('snapshot_date, scores')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(12),
  ]);

  const skills = ((skillsRes.data ?? []) as LearningSkill[]).map((s) => ({
    ...s,
    parent_id: s.parent_id ?? null,
  }));
  const { parents } = partitionSkillTree(skills);
  const focus = focusRes.data;
  const focusSkill = parents.find((s) => s.id === focus?.skill_id);
  const pinStats = summarizePins((pinsRes.data ?? []) as { slot: string; done: boolean }[]);
  const snapshots = (snapshotsRes.data ?? []).map((s) => ({
    snapshot_date: s.snapshot_date as string,
    scores: (s.scores as Record<string, number>) ?? {},
  }));

  if (!focusSkill && pinStats.mustTotal === 0) return null;

  return {
    weekStart: prevStart,
    focusLabel: focusSkill?.label ?? null,
    focusTarget: focus?.target_level ?? null,
    mustDone: pinStats.mustDone,
    mustTotal: pinStats.mustTotal,
    focusScore: focusScoreForWeek(parents, snapshots, prevStart, focus),
  };
}
