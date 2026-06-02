-- ============================================================
-- VANGUARD OS — ANALYST CRON JOB
-- Uruchamia silnik cienia codziennie o 03:00 UTC
-- (godzinę przed briefingiem o 04:00 UTC)
-- ============================================================

SELECT cron.schedule(
  'vanguard-daily-analyst',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/vanguard-analyst',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
