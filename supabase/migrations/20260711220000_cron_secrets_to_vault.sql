-- ============================================================
-- P1.1 — MOVE CRON SERVICE-ROLE SECRET INTO SUPABASE VAULT
-- ============================================================
-- All 12 HTTP-calling pg_cron jobs had the service-role bearer token inline,
-- plaintext, in cron.job.command — readable by anyone with SELECT on cron.job.
-- The secret itself was already stored via vault.create_secret(...) as
-- 'vanguard_cron_service_role_key' (an ad-hoc administrative step, not run from
-- this file — the literal value must never enter migration history). This
-- migration only repoints each job's command at that vault entry by name.
--
-- Pattern replacing every occurrence:
--   'Authorization','Bearer sb_secret_...'
--   -> 'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')

SELECT cron.alter_job(job_id := 57, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-nightly?action=rescore-workout-sessions',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key'))
  );
  $cmd$);

SELECT cron.alter_job(job_id := 32, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/sync?service=oura',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')),
    body := jsonb_build_object('userId','165ae341-670c-46ce-82dc-434c4dbfcdfd')
  );
  $cmd$);

SELECT cron.alter_job(job_id := 33, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/sync?service=oura',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')),
    body := jsonb_build_object('userId','165ae341-670c-46ce-82dc-434c4dbfcdfd')
  );
  $cmd$);

SELECT cron.alter_job(job_id := 56, command := $cmd$
  SELECT net.http_post(
    url     := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-push-reminder',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
               ),
    body    := '{}'::jsonb
  ) AS request_id;
  $cmd$);

SELECT cron.alter_job(job_id := 36, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-analyst',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $cmd$);

SELECT cron.alter_job(job_id := 30, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/recap?type=daily',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key'))
  );
  $cmd$);

SELECT cron.alter_job(job_id := 51, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-eval-interview',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $cmd$);

SELECT cron.alter_job(job_id := 65, command := $cmd$
    SELECT net.http_post(
        url     := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-metabolism',
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
                   ),
        body    := '{}'::jsonb
    ) as request_id;
  $cmd$);

SELECT cron.alter_job(job_id := 66, command := $cmd$
  SELECT net.http_post(
    url     := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-nightly',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
               ),
    body    := jsonb_build_object('userId', '165ae341-670c-46ce-82dc-434c4dbfcdfd')
  ) as request_id;
  $cmd$);

SELECT cron.alter_job(job_id := 55, command := $cmd$
  SELECT net.http_post(
    url      := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-nutrition-coach',
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
                ),
    body     := '{"notify": true}'::jsonb
  ) AS request_id;
  $cmd$);

SELECT cron.alter_job(job_id := 43, command := $cmd$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/recap?type=weekly-synthesis',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key'))
  );
  $cmd$);

SELECT cron.alter_job(job_id := 64, command := $cmd$
  SELECT net.http_post(
    url      := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-wiki-compiler',
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vanguard_cron_service_role_key')
                ),
    body     := jsonb_build_object(
                  'mode',  'domain-daily',
                  'days',  21,
                  'limit', 60
                )
  ) AS request_id;
  $cmd$);
