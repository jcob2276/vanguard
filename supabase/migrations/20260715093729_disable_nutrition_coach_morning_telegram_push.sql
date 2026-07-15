-- Stop the 08:00 Telegram push from vanguard-nutrition-coach (job 55).
-- Keeps the daily nutrition_targets computation running (diet tab depends on it),
-- only removes the `notify: true` flag that triggers the Telegram send.
SELECT cron.alter_job(
  job_id := 55,
  command := $cmd$
    SELECT net.http_post(
      url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-nutrition-coach',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cmd$
);
