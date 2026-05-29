-- ============================================================================
-- COMPLETE FRICTION EVENTS SCHEMA
-- Date: 2026-05-28
-- Purpose: Bring friction_events table to the full schema expected by
--          vanguard-auto-classify + all downstream consumers.
--
-- This migration is the authoritative fix for the long-standing schema drift
-- where the classification prompt and INSERT code were ahead of the database.
--
-- Safe to run multiple times.
-- ============================================================================

-- 1. Add all columns required by the friction extraction prompt
ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS event_kind text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS declared_intention text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS actual_behavior text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS deviation text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS immediate_cost text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS emotional_state text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS people_involved text[];

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS location_context text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS confidence numeric;

-- 2. Enforce allowed values for event_kind (data quality guardrail)
ALTER TABLE friction_events
  DROP CONSTRAINT IF EXISTS friction_events_event_kind_check;

ALTER TABLE friction_events
  ADD CONSTRAINT friction_events_event_kind_check
  CHECK (
    event_kind IS NULL OR event_kind IN (
      'friction_event',
      'positive_micro_action',
      'state_observation',
      'micro_behavior_observation',
      'reflection'
    )
  );

-- 3. Performance indexes for the main access patterns
-- (used by daily-reconciliation, weekly-synthesis, analyst, friction-qa, oracle)
CREATE INDEX IF NOT EXISTS idx_friction_events_event_kind
  ON friction_events (user_id, event_kind, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_friction_events_friction_type
  ON friction_events (user_id, friction_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_friction_events_status
  ON friction_events (user_id, status, occurred_at DESC);

-- 4. Documentation for future humans
COMMENT ON COLUMN friction_events.event_kind IS
  'Classification from auto-classify. One of: friction_event, positive_micro_action, state_observation, micro_behavior_observation, reflection.';

COMMENT ON COLUMN friction_events.status IS
  'Processing status. Common values: raw, reviewed, confirmed, user_corrected, rejected.';

COMMENT ON COLUMN friction_events.declared_intention IS
  'What the user intended to do (extracted literally when present).';

COMMENT ON COLUMN friction_events.actual_behavior IS
  'What the user actually did or observed (extracted literally when present).';

COMMENT ON COLUMN friction_events.deviation IS
  'Description of the gap between declared_intention and actual_behavior.';

COMMENT ON COLUMN friction_events.immediate_cost IS
  'Immediate negative consequence mentioned in the stream record.';

-- 5. Update the quality gate view used by Oracle, reconciliation, analyst, etc.
CREATE OR REPLACE VIEW public.confirmed_friction_events AS
  SELECT *
  FROM public.friction_events
  WHERE status IN ('good', 'user_confirmed', 'user_corrected')
    AND event_kind IN ('friction_event', 'positive_micro_action');

COMMENT ON VIEW public.confirmed_friction_events IS
  'High-signal behavioral friction and positive micro-actions only. Primary source for Oracle context, daily reconciliation, weekly synthesis and analyst.';

-- ============================================================================
-- POST-APPLICATION STEPS (run manually after supabase db push / migration)
--
-- 1. Verify columns exist:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'friction_events' ORDER BY ordinal_position;
--
-- 2. (Recommended) One-time backfill of recent valuable records:
--    - Re-process the last 14-30 days of vanguard_stream through
--      vanguard-auto-classify (or write a small backfill script).
--    - This is the only way old records will get the rich fields populated.
--
-- 3. After backfill, you can run:
--    SELECT event_kind, COUNT(*) FROM friction_events GROUP BY event_kind;
--    to see the distribution.
--
-- Do NOT drop old partial migrations (20260525172000 etc.) — they are historical.
-- ============================================================================
