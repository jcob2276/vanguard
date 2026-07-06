-- Dodanie crona dla vanguard-metabolism (np. co tydzień w poniedziałek o 03:00)

select cron.unschedule('vanguard-metabolism')
where exists (select 1 from cron.job where jobname = 'vanguard-metabolism');

SELECT cron.schedule(
  'vanguard-metabolism',
  '0 3 * * 1',
  $$
    SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/vanguard-metabolism',
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                   ),
        body    := '{}'::jsonb
    ) as request_id;
  $$
);
