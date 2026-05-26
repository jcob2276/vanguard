ALTER TABLE daily_reconciliations
  ADD COLUMN IF NOT EXISTS morning_ping_sent_at timestamptz;
