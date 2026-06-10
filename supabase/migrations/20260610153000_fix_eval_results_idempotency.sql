ALTER TABLE public.vanguard_eval_results
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium';

UPDATE public.vanguard_eval_results
SET difficulty = 'medium'
WHERE difficulty IS NULL;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY run_id, question_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.vanguard_eval_results
)
DELETE FROM public.vanguard_eval_results r
USING ranked d
WHERE r.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vanguard_eval_results_run_question
  ON public.vanguard_eval_results(run_id, question_id);
