-- Vanguard Wiki Compiler cron
-- Runs after vanguard-daily-analyst and refreshes derived compiled memory.

DO $$
BEGIN
  PERFORM cron.unschedule('vanguard-wiki-compiler');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'vanguard-wiki-compiler',
  '20 3 * * *',
  $$
  SELECT net.http_post(
    url      := current_setting('app.supabase_url') || '/functions/v1/vanguard-wiki-compiler',
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                ),
    body     := jsonb_build_object(
                  'mode',  'domain-daily',
                  'days',  21,
                  'limit', 60
                )
  ) AS request_id;
  $$
);
