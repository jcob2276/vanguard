-- Final plan artifact column on daily_reconciliations
-- Populated when user ends planning session with koniec/done/gotowe

ALTER TABLE IF EXISTS daily_reconciliations
  ADD COLUMN IF NOT EXISTS planning_summary text;
