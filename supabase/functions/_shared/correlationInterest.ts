/** Which correlation / behavior rows are worth surfacing in UI (not noise). */

interface CorrelationLike {
  discovered: boolean
  significant: boolean
  has_enough_data: boolean
  r_abs: number
  n: number
  p: number
  x_metric?: string
  y_metric?: string
}

export interface BehaviorEffectLike {
  behavior_key: string
  significant: boolean
  cohens_d: number | null
  n_with: number
  n_without: number
  p_value: number | null
}

/** Private / mundane behavior keys — hide unless statistically strong. */
const PRIVATE_BEHAVIOR = /masturb|walenie|pmo|porn|fap|masturbacja/i

export function isPrivateBehaviorKey(key: string): boolean {
  return PRIVATE_BEHAVIOR.test(key)
}

export function isPrivateBehaviorMetric(metric: string): boolean {
  if (metric.startsWith('behav__')) {
    return PRIVATE_BEHAVIOR.test(metric.replace(/^behav__/, ''))
  }
  if (metric.startsWith('habit__')) {
    const slug = metric.replace(/^habit__/, '')
    return PRIVATE_BEHAVIOR.test(slug) || slug === 'lenie'
  }
  return false
}

export function isInterestingCorrelation(r: CorrelationLike & { x_metric?: string; y_metric?: string }): boolean {
  if (!r.has_enough_data || r.n < 5) return false

  const privatePair = (r.x_metric && isPrivateBehaviorMetric(r.x_metric))
    || (r.y_metric && isPrivateBehaviorMetric(r.y_metric))
  if (privatePair) {
    return !!(r.significant && r.n >= 10 && r.r_abs >= 0.35)
  }

  if (r.significant && r.n >= 8) return true
  if (r.r_abs >= 0.28 && r.n >= 8) return true
  if (r.r_abs >= 0.22 && r.n >= 12 && r.p < 0.12) return true
  if (r.r_abs >= 0.38 && r.n >= 6 && r.p < 0.08) return true
  return false
}

export function isInterestingBehaviorEffect(
  b: BehaviorEffectLike,
  opts?: { includePrivate?: boolean },
): boolean {
  const minGroup = Math.min(b.n_with, b.n_without)
  if (minGroup < 4) return false

  const privateKey = isPrivateBehaviorKey(b.behavior_key)
  if (privateKey) {
    if (!opts?.includePrivate) return false
    return !!(b.significant && minGroup >= 6 && Math.abs(b.cohens_d ?? 0) >= 0.5)
  }

  if (b.significant && minGroup >= 5) return true
  if (Math.abs(b.cohens_d ?? 0) >= 0.55 && minGroup >= 5) return true
  if (Math.abs(b.cohens_d ?? 0) >= 0.75 && minGroup >= 4 && (b.p_value ?? 1) < 0.1) return true
  return false
}

export function correlationInterestScore(r: CorrelationLike & { cross_domain?: boolean }): number {
  let score = r.r_abs * 100
  if (r.significant) score += 40
  score += Math.min(r.n, 30) * 0.5
  if (r.p < 0.01) score += 10
  if (r.cross_domain) score += 18
  return score
}
