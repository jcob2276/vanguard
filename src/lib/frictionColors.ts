/**
 * Friction type color mapping for UI — frontend-side copy of the canonical definition
 * in supabase/functions/_shared/domain.ts. The shared file is Deno-targeted; importing it
 * directly from src/ crosses the architectural boundary. Keep in sync manually when
 * friction types change (the _shared version is authoritative for DB/edge functions).
 */

export const ALLOWED_FRICTION_TYPES = [
  'sleep_disruption',
  'avoidance',
  'procrastination',
  'habit_break',
  'training_drop',
  'social_hesitation',
  'communication_drift',
  'emotional_spike',
  'self_control_break',
  'positive_micro_action',
  'recovery_anchor',
  'adaptive_move',
  'other',
] as const;

export type FrictionType = typeof ALLOWED_FRICTION_TYPES[number];

/** Centralized color mapping for friction type UI badges and charts. */
export const FRICTION_COLOR: Record<FrictionType, string> = {
  sleep_disruption: 'var(--legacy-lib-color-023)',
  avoidance: 'var(--legacy-lib-color-021)',
  procrastination: 'var(--legacy-lib-color-025)',
  habit_break: 'var(--legacy-lib-color-019)',
  training_drop: 'var(--legacy-lib-color-014)',
  social_hesitation: 'var(--legacy-lib-color-009)',
  communication_drift: 'var(--legacy-lib-color-016)',
  emotional_spike: 'var(--legacy-lib-color-022)',
  self_control_break: 'var(--legacy-lib-color-020)',
  positive_micro_action: 'var(--legacy-lib-color-005)',
  recovery_anchor: 'var(--legacy-lib-color-010)',
  adaptive_move: 'var(--legacy-lib-color-008)',
  other: 'var(--legacy-lib-color-018)',
};
