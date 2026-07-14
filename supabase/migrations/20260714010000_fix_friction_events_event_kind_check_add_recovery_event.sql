-- ALLOWED_EVENT_KINDS w supabase/functions/_shared/domain.ts i prompts.ts (vanguard-auto-classify)
-- zawsze zezwalały na 'recovery_event', ale CHECK constraint w bazie go nie miał —
-- każdy insert do friction_events z tym event_kind wywalał się na produkcji (safeExecute rzucał błąd).
ALTER TABLE public.friction_events DROP CONSTRAINT friction_events_event_kind_check;
ALTER TABLE public.friction_events ADD CONSTRAINT friction_events_event_kind_check
  CHECK (event_kind IS NULL OR event_kind = ANY (ARRAY[
    'friction_event'::text,
    'positive_micro_action'::text,
    'recovery_event'::text,
    'state_observation'::text,
    'micro_behavior_observation'::text,
    'reflection'::text
  ]));
