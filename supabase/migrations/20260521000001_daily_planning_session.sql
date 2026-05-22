-- Evening planning session columns on daily_reconciliations
-- Triggered automatically after user answers daily reconciliation

ALTER TABLE IF EXISTS daily_reconciliations
  ADD COLUMN IF NOT EXISTS planning_status text DEFAULT 'pending'
    CHECK (planning_status IN ('pending', 'active', 'completed')),
  ADD COLUMN IF NOT EXISTS planning_history jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_planning
  ON daily_reconciliations(user_id, planning_status, created_at DESC);
