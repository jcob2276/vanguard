-- Prevent duplicate eval_interview stream entries for the same question
-- Fixes race condition: concurrent cron triggers both pass the 20h guard,
-- but only the first insert succeeds; second gets unique violation → aborts telegram send
CREATE UNIQUE INDEX IF NOT EXISTS idx_vanguard_stream_eval_interview_dedup
  ON public.vanguard_stream (user_id, (metadata->>'eval_question_id'))
  WHERE source = 'eval_interview' AND metadata->>'eval_question_id' IS NOT NULL;
