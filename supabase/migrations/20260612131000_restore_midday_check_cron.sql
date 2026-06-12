-- Restore the useful noon Telegram check.
-- Current Warsaw summer time: 12:00 CEST = 10:00 UTC.

select cron.unschedule('vanguard-midday-check')
where exists (select 1 from cron.job where jobname = 'vanguard-midday-check');

select cron.schedule(
  'vanguard-midday-check',
  '0 10 * * *',
  $$
  select net.http_post(
    url      := current_setting('app.supabase_url') || '/functions/v1/vanguard-midday-check',
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                ),
    body     := '{}'::jsonb
  ) as request_id;
  $$
);
