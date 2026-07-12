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
  sleep_disruption: '#f59e0b',
  avoidance: '#f43f5e',
  procrastination: '#fb923c',
  habit_break: '#a78bfa',
  training_drop: '#60a5fa',
  social_hesitation: '#34d399',
  communication_drift: '#94a3b8',
  emotional_spike: '#f472b6',
  self_control_break: '#ef4444',
  positive_micro_action: '#10b981',
  recovery_anchor: '#38bdf8',
  adaptive_move: '#2dd4bf',
  other: '#9ca3af',
};
