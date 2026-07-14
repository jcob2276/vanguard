/**
 * @module personalTargets
 * @purpose Single source of truth for user's personal goal parameters.
 *
 * Reads from:
 *   - nutrition_targets  (most recent row) → protein_floor_g, target_kcal
 *   - nutrition_profile                    → protein_g_per_kg, sleep_target_hours, weight fallback
 *   - body_metrics                         → latest weight (for protein fallback calc)
 *
 * Used by:
 *   - fitnessScoreUtils (frontend, via useDesktopData)
 *   - recovery_score.ts → computeRecoveryScore (SLEEP_TARGET + sleep perf denominator)
 *   - metrics_recovery.ts → runComputeRecoveryForecast (needSleepHours)
 *   - vanguard-nightly (orchestrator)
 *
 * NEVER hardcode 140g protein or 8.0h sleep elsewhere — use this resolver.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const DEFAULT_PROTEIN_FLOOR_G = 150;
export const DEFAULT_SLEEP_TARGET_H = 8.0;

export interface PersonalTargets {
  /** Minimum daily protein (g). From nutrition_targets.protein_floor_g (latest).
   *  Falls back to: weight_kg × protein_g_per_kg, then DEFAULT_PROTEIN_FLOOR_G. */
  proteinFloorG: number;
  /** Daily kcal target. From nutrition_targets.target_kcal (latest). Null if coach hasn't run yet. */
  targetKcal: number | null;
  /** Personal sleep need (h). From nutrition_profile.sleep_target_hours (default 8.0).
   *  Used as 100%-sleep-performance denominator AND as debt ledger target in recovery_score. */
  sleepTargetH: number;
}

export async function resolvePersonalTargets(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonalTargets> {
  const [targetsRes, profileRes, bodyRes] = await Promise.all([
    supabase
      .from('nutrition_targets')
      .select('protein_floor_g, target_kcal')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('nutrition_profile')
      .select('protein_g_per_kg, sleep_target_hours')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('body_metrics')
      .select('weight')
      .eq('user_id', userId)
      .not('weight', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const target = targetsRes.data;
  const profile = profileRes.data;
  const body = bodyRes.data;

  // --- protein floor ---
  let proteinFloorG = DEFAULT_PROTEIN_FLOOR_G;
  if (target?.protein_floor_g != null && Number(target.protein_floor_g) > 0) {
    proteinFloorG = Number(target.protein_floor_g);
  } else if (profile?.protein_g_per_kg != null && body?.weight != null) {
    // nutrition-coach hasn't run yet — compute the same way it would
    proteinFloorG = Math.round(Number(body.weight) * Number(profile.protein_g_per_kg));
  }

  // --- kcal target ---
  const targetKcal =
    target?.target_kcal != null ? Number(target.target_kcal) : null;

  // --- sleep target ---
  const sleepTargetH =
    profile?.sleep_target_hours != null && Number(profile.sleep_target_hours) > 0
      ? Number(profile.sleep_target_hours)
      : DEFAULT_SLEEP_TARGET_H;

  return { proteinFloorG, targetKcal, sleepTargetH };
}
