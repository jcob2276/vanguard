-- Midday check state tracking on daily_reconciliations
-- midday_status: callback response from user (done/not_done/stuck)
-- midday_sent_at: when the midday message was sent (prevents duplicate sends)

ALTER TABLE IF EXISTS daily_reconciliations
  ADD COLUMN IF NOT EXISTS midday_status text
    CHECK (midday_status IN ('done', 'not_done', 'stuck')),
  ADD COLUMN IF NOT EXISTS midday_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_midday
  ON daily_reconciliations(user_id, midday_sent_at, created_at DESC);
