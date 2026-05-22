-- Morning brief cron: 05:00 UTC daily = 07:00 Warsaw (CEST) / 06:00 (CET)
-- Triggers vanguard-morning-brief edge function (verify_jwt: false, no auth header needed)

SELECT cron.schedule(
  'vanguard-morning-brief',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-morning-brief',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body   := '{}'::jsonb
  )
  $$
);
