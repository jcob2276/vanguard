-- Strava API paywalled (see lessons.md 2026-07-04) — swap the daily
-- training sync cron from sync-strava to sync-intervals (intervals.icu,
-- free, backed by its own official Garmin Connect OAuth integration).
-- Idempotent: safe to re-run regardless of which jobs currently exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vanguard-sync-strava') THEN
    PERFORM cron.unschedule('vanguard-sync-strava');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vanguard-sync-intervals') THEN
    PERFORM cron.unschedule('vanguard-sync-intervals');
  END IF;
END $$;

SELECT cron.schedule(
  'vanguard-sync-intervals',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/sync-intervals',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
