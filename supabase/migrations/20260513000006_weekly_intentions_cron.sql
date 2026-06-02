-- ============================================================
-- VANGUARD OS — WEEKLY INTENTIONS CLEANUP (TASK-11)
-- Harmonogram: Każda niedziela o 00:00 UTC
-- ============================================================

SELECT cron.schedule(
  'vanguard-weekly-intentions-cleanup',
  '0 0 * * 0',
  $$
  select
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/vanguard-intentions-cleanup',
      headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
