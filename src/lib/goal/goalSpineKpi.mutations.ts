import { supabase } from '../supabase';
import type { GoalKpiRow, RollupDecision } from './goalSpine.types';
import { invalidateGoalSpineCache } from './goalSpine.queries';

export async function addProjectKpi(
  userId: string,
  projectId: string,
  pillar: string,
  fields: { name: string; unit: string; target?: number | null },
): Promise<GoalKpiRow> {
  const { data, error } = await supabase
    .from('goal_kpis')
    .insert({
      user_id: userId,
      project_id: projectId,
      pillar,
      name: fields.name.trim(),
      unit: fields.unit.trim(),
      target: fields.target ?? null,
      higher_is_better: true,
    })
    .select()
    .single();
  if (error) throw error;
  invalidateGoalSpineCache(userId);
  return data;
}

export async function setProjectKpiTarget(userId: string, kpiId: string, target: number | null): Promise<void> {
  const { error } = await supabase.from('goal_kpis').update({ target }).eq('id', kpiId);
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

/** Pure decision: does this daily task completion roll up into a project KPI? */
export function rollupTaskCompletion(
  targetValue: string | null | undefined,
  projectKpis: GoalKpiRow[] | null | undefined,
  sign: 1 | -1,
  preferredKpiId?: string | null,
): RollupDecision {
  const trimmed = targetValue?.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  if (!projectKpis?.length) return null;

  const picked = pickRollupKpi(projectKpis, preferredKpiId);
  if (!picked) return null;

  const amount = parseFloat(trimmed);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return { kpiId: picked.id, delta: amount * sign };
}

function pickRollupKpi(
  kpis: GoalKpiRow[],
  preferredKpiId?: string | null,
): GoalKpiRow | null {
  if (!kpis.length) return null;
  if (preferredKpiId) {
    const hit = kpis.find((k) => k.id === preferredKpiId);
    if (hit) return hit;
  }
  if (kpis.length === 1) return kpis[0];
  const scored = kpis
    .filter((k) => k.target != null && Number.isFinite(k.target) && k.target > 0)
    .sort((a, b) => (b.target ?? 0) - (a.target ?? 0));
  return scored[0] ?? kpis[0];
}

export async function applyKpiRollup(
  userId: string,
  kpiId: string,
  weekStart: string,
  delta: number,
): Promise<void> {
  const { error } = await supabase.rpc('increment_kpi_entry_for_week', {
    p_kpi_id: kpiId,
    p_week_start: weekStart,
    p_delta: delta,
  });
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}
