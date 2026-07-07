-- Strava sync: 22:30 Warsaw CEST = 20:30 UTC
SELECT cron.schedule(
  'vanguard-sync-strava',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sync-strava',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
