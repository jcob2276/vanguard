-- ALLOWED_FRICTION_TYPES (supabase/functions/_shared/domain.ts) i FRICTION_SYSTEM prompt
-- (vanguard-auto-classify/prompts.ts) od dawna zawierają 'recovery_anchor' i 'adaptive_move' —
-- prompt wprost instruuje LLM, żeby ich używał (przykład w prompcie używa recovery_anchor).
-- CHECK constraint ich nie miał, więc każde takie tarcie wywalało insert do friction_events
-- (identyczna klasa buga co brakujący 'recovery_event' w event_kind, naprawiony dzień wcześniej).
-- 'social_withdrawal' zostaje dla kompatybilności z istniejącymi wierszami.
ALTER TABLE public.friction_events DROP CONSTRAINT friction_events_friction_type_check;
ALTER TABLE public.friction_events ADD CONSTRAINT friction_events_friction_type_check
  CHECK (friction_type = ANY (ARRAY[
    'avoidance'::text,
    'procrastination'::text,
    'emotional_spike'::text,
    'habit_break'::text,
    'social_withdrawal'::text,
    'sleep_disruption'::text,
    'training_drop'::text,
    'social_hesitation'::text,
    'communication_drift'::text,
    'self_control_break'::text,
    'positive_micro_action'::text,
    'recovery_anchor'::text,
    'adaptive_move'::text,
    'other'::text
  ]));
