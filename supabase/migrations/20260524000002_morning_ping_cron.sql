-- Morning ping: 20 min after morning brief, fires if user hasn't clicked yet
-- 05:20 UTC = 07:20 Warsaw CEST
SELECT cron.schedule(
  'vanguard-morning-ping',
  '20 5 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-morning-ping',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body   := '{}'::jsonb
  )
  $$
);
