-- vanguard-daily-reconciliation has been inserting mode='reflection' for the
-- evening reflection flow, but the check constraint never allowed it — every
-- nightly reflection upsert has been failing silently since 2026-06-19
-- (Telegram message still sends; only the daily_reconciliations row is lost).
ALTER TABLE daily_reconciliations DROP CONSTRAINT daily_reconciliations_mode_check;
ALTER TABLE daily_reconciliations ADD CONSTRAINT daily_reconciliations_mode_check
  CHECK (mode = ANY (ARRAY['full'::text, 'checkin'::text, 'morning_rescue'::text, 'reflection'::text]));
