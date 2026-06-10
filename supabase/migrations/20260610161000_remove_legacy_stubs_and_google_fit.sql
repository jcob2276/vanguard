-- Remove legacy/deprecated functions and Google Fit remnants from the database.
-- Function folders are deleted from the repository; this migration removes old
-- cron entries and stale user_settings columns if they still exist.

DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    FOR r IN
      SELECT jobname
      FROM cron.job
      WHERE jobname IN (
        'vanguard-reset-prompt',
        'vanguard-reset-prompt-cron',
        'vanguard-weekly-intentions-cleanup',
        'weekly-report'
      )
      OR command ILIKE '%vanguard-reset-prompt%'
      OR command ILIKE '%vanguard-intentions-cleanup%'
      OR command ILIKE '%google-fit-auth%'
      OR command ILIKE '%sync-google-fit%'
      OR command ILIKE '%weekly-report%'
    LOOP
      PERFORM cron.unschedule(r.jobname);
    END LOOP;
  END IF;
END;
$$;

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS google_fit_refresh_token,
  DROP COLUMN IF EXISTS google_fit_client_id,
  DROP COLUMN IF EXISTS google_fit_client_secret;
