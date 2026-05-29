-- ============================================================================
-- FAZA 0 — Schema reconcile: prod ← kod (auto-classify v32+, reflection P2)
-- Date: 2026-05-29
-- Supersedes (moved to _pending_faza1/):
--   20260528000001_complete_friction_events_schema.sql
--   20260530000001_add_extraction_quality_to_friction.sql
--   20260527100001_add_p2_parsed_to_reconciliations.sql
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- 1. friction_events: wszystkie kolumny wymagane przez auto-classify INSERT (HEAD)
ALTER TABLE public.friction_events
  ADD COLUMN IF NOT EXISTS event_kind          text,
  ADD COLUMN IF NOT EXISTS declared_intention  text,
  ADD COLUMN IF NOT EXISTS actual_behavior     text,
  ADD COLUMN IF NOT EXISTS deviation           text,
  ADD COLUMN IF NOT EXISTS immediate_cost      text,
  ADD COLUMN IF NOT EXISTS emotional_state     text,
  ADD COLUMN IF NOT EXISTS people_involved     text[],
  ADD COLUMN IF NOT EXISTS location_context    text,
  ADD COLUMN IF NOT EXISTS extraction_quality  integer;

-- 2. CHECK taksonomii event_kind (NULL dozwolony dla rekordów legacy bez backfilla)
ALTER TABLE public.friction_events
  DROP CONSTRAINT IF EXISTS friction_events_event_kind_check;
ALTER TABLE public.friction_events
  ADD CONSTRAINT friction_events_event_kind_check
  CHECK (event_kind IS NULL OR event_kind IN (
    'friction_event',
    'positive_micro_action',
    'state_observation',
    'micro_behavior_observation',
    'reflection'
  ));

-- 3. Indeksy pod realne zapytania (friction-qa, reconciliation, analyst, oracle)
CREATE INDEX IF NOT EXISTS idx_friction_events_event_kind
  ON public.friction_events (user_id, event_kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_friction_events_friction_type_idx
  ON public.friction_events (user_id, friction_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_friction_events_status_idx
  ON public.friction_events (user_id, status, occurred_at DESC);

-- 4. confirmed_friction_events — filtr po review_status (zachowuje 8 istniejących wierszy).
--    event_kind IS NULL dopuszczony do czasu backfilla rekordów legacy.
--    Po backfillu: usunąć "OR event_kind IS NULL" z tego widoku.
CREATE OR REPLACE VIEW public.confirmed_friction_events AS
  SELECT * FROM public.friction_events
  WHERE review_status IN ('good', 'user_confirmed', 'user_corrected')
    AND (event_kind IS NULL OR event_kind IN ('friction_event', 'positive_micro_action'));

COMMENT ON VIEW public.confirmed_friction_events IS
  'High-signal behavioral friction and positive micro-actions only. '
  'Primary source for Oracle context, daily reconciliation, weekly synthesis and analyst. '
  'event_kind IS NULL allowed until legacy-record backfill is complete.';

-- 5. daily_reconciliations.p2_parsed (warstwa refleksji P2)
ALTER TABLE public.daily_reconciliations
  ADD COLUMN IF NOT EXISTS p2_parsed jsonb;

COMMENT ON COLUMN public.daily_reconciliations.p2_parsed IS
  'Structured P2 parser output. Fields: day_score (1-5), biggest_cost, best_move, '
  'correction, resource, blocker_candidates (jsonb array), parse_confidence (0.0-1.0), '
  'needs_manual_review (bool), unparsed_notes. Extracted from user_response voice-note.';

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_p2_parsed_not_null
  ON public.daily_reconciliations (user_id, date DESC)
  WHERE p2_parsed IS NOT NULL;
