-- Ensure deprecated vanguard-reset-prompt cron is not scheduled (idempotent)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('vanguard-reset-prompt');
    PERFORM cron.unschedule('vanguard-reset-prompt-cron');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'unschedule reset-prompt: %', SQLERRM;
END;
$$;
