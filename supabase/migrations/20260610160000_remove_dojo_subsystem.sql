-- Remove Practice Dojo subsystem from Vanguard.
-- This intentionally drops the disabled Dojo state tables and unschedules any
-- remaining Dojo cron jobs if they exist in production.

DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    FOR r IN
      SELECT jobname
      FROM cron.job
      WHERE jobname ILIKE '%dojo%'
    LOOP
      PERFORM cron.unschedule(r.jobname);
    END LOOP;
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.dojo_reps CASCADE;
DROP TABLE IF EXISTS public.dojo_runs CASCADE;
DROP TABLE IF EXISTS public.dojo_curricula CASCADE;
