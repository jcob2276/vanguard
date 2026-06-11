-- =====================================================
-- REGISTER pg_cron JOB: vanguard-eval-interview
-- 2026-06-10
-- Runs Mon–Fri at 10:00 UTC (12:00 Warsaw)
-- Sends one failing eval question to Telegram as natural interview prompt
-- =====================================================
SELECT cron.schedule(
  'vanguard-eval-interview',
  '0 10 * * 1-5',
  $$
  SELECT net.http_post(
    url      := current_setting('app.supabase_url') || '/functions/v1/vanguard-eval-interview',
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                ),
    body     := '{}'::jsonb
  ) AS request_id;
  $$
);
