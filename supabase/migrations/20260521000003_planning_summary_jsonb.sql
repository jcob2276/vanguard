-- Change planning_summary from text to jsonb for structured field access
-- Allows querying top3, ryzyko, kontrplan, pilne, pierwszy_ruch individually

ALTER TABLE IF EXISTS daily_reconciliations
  DROP COLUMN IF EXISTS planning_summary;

ALTER TABLE IF EXISTS daily_reconciliations
  ADD COLUMN IF NOT EXISTS planning_summary jsonb;
