-- Drop legacy project_checkpoints after backfill to todo_items (20260630120000).
-- Repoint daily_wins.task_N_checkpoint_id FKs to todo_items before drop.

DO $$
DECLARE
  n int;
BEGIN
  FOR n IN 1..5 LOOP
    EXECUTE format(
      'ALTER TABLE public.daily_wins DROP CONSTRAINT IF EXISTS daily_wins_task_%s_checkpoint_id_fkey',
      n
    );
    EXECUTE format(
      'ALTER TABLE public.daily_wins
         ADD CONSTRAINT daily_wins_task_%s_checkpoint_id_fkey
         FOREIGN KEY (task_%s_checkpoint_id) REFERENCES public.todo_items(id) ON DELETE SET NULL',
      n, n
    );
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.project_checkpoints CASCADE;
