/**
 * Friction type color mapping for UI — frontend-side copy of the canonical definition
 * in supabase/functions/_shared/domain.ts. The shared file is Deno-targeted; importing it
 * directly from src/ crosses the architectural boundary. Keep in sync manually when
 * friction types change (the _shared version is authoritative for DB/edge functions).
 */

export type FrictionType =
  | 'sleep_disruption'
  | 'avoidance'
  | 'procrastination'
  | 'habit_break'
  | 'training_drop'
  | 'social_hesitation'
  | 'communication_drift'
  | 'emotional_spike'
  | 'self_control_break'
  | 'positive_micro_action'
  | 'recovery_anchor'
  | 'adaptive_move'
  | 'other';

/** Centralized color mapping for friction type UI badges and charts. */
export const FRICTION_COLOR: Record<FrictionType, string> = {
  sleep_disruption: 'var(--color-warning-amber)',
  avoidance: 'var(--color-danger-red)',
  procrastination: 'var(--color-theme-hex-fb923c-coll-2)',
  habit_break: 'var(--color-theme-hex-a78bfa-coll-2)',
  training_drop: 'var(--color-theme-hex-60a5fa-coll-2)',
  social_hesitation: 'var(--color-theme-hex-34d399)',
  communication_drift: 'var(--color-theme-hex-94a3b8-coll-2)',
  emotional_spike: 'var(--color-theme-hex-f472b6-coll-2)',
  self_control_break: 'var(--color-theme-hex-ef4444-coll-2)',
  positive_micro_action: 'var(--color-success-green)',
  recovery_anchor: 'var(--color-theme-hex-38bdf8)',
  adaptive_move: 'var(--color-theme-hex-2dd4bf-coll-2)',
  other: 'var(--color-theme-hex-9ca3af)',
};
