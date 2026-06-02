-- ============================================================
-- VANGUARD OS — DAILY SHADOW ANALYSIS (TASK-11+)
-- Harmonogram: Codziennie o 03:00 UTC
-- ============================================================

SELECT cron.schedule(
  'vanguard-daily-shadow-analysis',
  '0 3 * * *',
  $$
  select
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/vanguard-analyst',
      headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
