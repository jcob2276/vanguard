ALTER TABLE vanguard_daily_aggregates
  ADD COLUMN IF NOT EXISTS strava_activities_json jsonb;
