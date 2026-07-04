-- Vanguard Detect Patterns cron
-- The behavioral pattern detector (early warning / recurring blockers / plan
-- adherence gaps) previously only ran when the user tapped "Wykryj wzorce"
-- in the UI — no scheduled job ever re-ran it, so detected patterns went
-- stale indefinitely (confirmed: the only row in vanguard_behavioral_patterns
-- hadn't been touched in 3+ weeks). Runs daily at 19:45, right after
-- vanguard-daily-reconciliation (19:30) so same-day reconciliation data is
-- fresh for the detectors that read it.
--
-- NOTE: as applied to the live project, the Authorization header uses the
-- literal service role key (same convention as the other crons in
-- cron.job) rather than the placeholder below — never commit that secret
-- to this file.

DO $$
BEGIN
  PERFORM cron.unschedule('vanguard-detect-patterns-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'vanguard-detect-patterns-daily',
  '45 19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-detect-patterns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
