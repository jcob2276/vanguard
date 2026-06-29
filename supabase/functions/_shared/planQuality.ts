/**
 * planQuality.ts
 * 
 * Shared utilities for evaluating the quality/trustworthiness of a planning_summary.
 * Goal: Have ONE place that decides "how good was this plan signal?"
 */

export type PlanQuality = 'good' | 'rescue' | 'minimum' | 'unknown';

export interface PlanQualitySignal {
  quality: PlanQuality;
  isLowQuality: boolean;
  isVeryWeak: boolean;           // very bad (failure_reason or explicit minimum)
  failureReason?: string | null;
  mode?: string | null;
  isFallback: boolean;
  parseError: boolean;
}

/**
 * Evaluates a planning_summary object and returns a normalized quality signal.
 * This is the single source of truth for "was this plan good or not?"
 */
export function getPlanQualitySignal(plan: any): PlanQualitySignal {
  if (!plan) {
    return {
      quality: 'unknown',
      isLowQuality: true,
      isVeryWeak: true,
      failureReason: null,
      mode: null,
      isFallback: false,
      parseError: false,
    };
  }

  const quality = (plan.plan_quality as PlanQuality) || 'unknown';
  const failureReason = plan.plan_failure_reason || null;
  const mode = plan.mode || null;
  const isFallback = !!plan.plan_fallback;
  const parseError = !!plan.parse_error;

  const isLowQuality =
    quality === 'minimum' ||
    quality === 'rescue' ||
    mode === 'rescue' ||
    !!failureReason ||
    isFallback;

  const isVeryWeak = !!failureReason || quality === 'minimum';

  return {
    quality,
    isLowQuality,
    isVeryWeak,
    failureReason,
    mode,
    isFallback,
    parseError,
  };
}
