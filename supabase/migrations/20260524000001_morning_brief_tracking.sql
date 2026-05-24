-- Morning brief interaction tracking + day execution metrics
ALTER TABLE daily_reconciliations
  ADD COLUMN IF NOT EXISTS morning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS morning_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS morning_action text,
  ADD COLUMN IF NOT EXISTS phone_drift_morning boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compression_mode_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_move_started boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS evening_extraction jsonb,
  ADD COLUMN IF NOT EXISTS midday_blocker text;
