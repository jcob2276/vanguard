-- Add p2_parsed column to daily_reconciliations for structured P2 parser output.
-- Safe to run multiple times.

ALTER TABLE daily_reconciliations
  ADD COLUMN IF NOT EXISTS p2_parsed jsonb;

COMMENT ON COLUMN daily_reconciliations.p2_parsed IS
  'Structured P2 parser output. Fields: day_score (1-5), biggest_cost, best_move,
   correction, resource, blocker_candidates (jsonb array), parse_confidence (0.0-1.0),
   needs_manual_review (bool), unparsed_notes. Extracted from user_response voice-note.';

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_p2_parsed_not_null
  ON daily_reconciliations (user_id, date DESC)
  WHERE p2_parsed IS NOT NULL;
