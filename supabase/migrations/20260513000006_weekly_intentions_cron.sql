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
      url:='https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-intentions-cleanup',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4NDQ3OCwiZXhwIjoyMDkyOTYwNDc4fQ.lmEaTT7CmrMtdsM9EMyPY6HU8ZnDWYKQSYTr-mGkbTA"}'::jsonb
    ) as request_id;
  $$
);
