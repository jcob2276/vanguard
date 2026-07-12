import { supabase } from '../../../lib/supabase';
import { partitionSkillTree, type LearningSkill } from '../../../lib/growth/growth';
import {
  focusScoreForWeek,
  summarizePins,
  type GrowthPrevWeekSummary,
} from '../../../lib/growth/growthWeek';
import { shiftWeekStart } from '../../../lib/growth/growth';

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
