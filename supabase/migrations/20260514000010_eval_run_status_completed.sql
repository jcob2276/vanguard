-- Allow eval runner to mark finished runs with the status it already emits.

ALTER TABLE public.vanguard_eval_runs
DROP CONSTRAINT IF EXISTS vanguard_eval_runs_status_check;

ALTER TABLE public.vanguard_eval_runs
ADD CONSTRAINT vanguard_eval_runs_status_check
CHECK (status IN ('running', 'completed', 'passed', 'failed', 'error'));
