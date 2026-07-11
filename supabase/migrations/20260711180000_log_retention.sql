-- ============================================================
-- LOG RETENTION: Delete rows older than 90 days from
-- vanguard_llm_usage and vanguard_pipeline_runs.
-- ============================================================

-- Delete old LLM usage logs
DELETE FROM vanguard_llm_usage
WHERE created_at < now() - interval '90 days';

-- Delete old pipeline run logs
DELETE FROM vanguard_pipeline_runs
WHERE started_at < now() - interval '90 days';

-- Create a function for the weekly cron job
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM vanguard_llm_usage WHERE created_at < now() - interval '90 days';
  DELETE FROM vanguard_pipeline_runs WHERE started_at < now() - interval '90 days';
END;
$$;

-- Schedule weekly cleanup (Sundays at 03:00 UTC)
SELECT cron.schedule(
  'cleanup-old-logs',
  '0 3 * * 0',
  $$SELECT public.cleanup_old_logs()$$
);
