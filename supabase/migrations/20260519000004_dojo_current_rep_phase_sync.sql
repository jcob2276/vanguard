ALTER TABLE public.dojo_runs
  DROP CONSTRAINT IF EXISTS dojo_runs_current_rep_check;

ALTER TABLE public.dojo_runs
  ADD CONSTRAINT dojo_runs_current_rep_check
  CHECK (current_rep IN ('rep_a', 'correction_rep_a', 'rep_b', 'real_life_transfer', 'completed'));

UPDATE public.dojo_runs
SET current_rep = phase
WHERE current_rep IS DISTINCT FROM phase;
