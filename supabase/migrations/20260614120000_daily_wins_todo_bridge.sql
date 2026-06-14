-- Bridge: daily_wins task slots → todo_items.
-- Completing a PowerList slot auto-completes the linked Todo item (handled in frontend).
ALTER TABLE public.daily_wins
  ADD COLUMN IF NOT EXISTS task_1_todo_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_2_todo_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_3_todo_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_4_todo_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_5_todo_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL;

-- Add ai_bucket and ai_classified_at columns to todo_items if not present
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS ai_bucket text CHECK (ai_bucket IN ('today', 'soon', 'later', 'future')) DEFAULT 'later',
  ADD COLUMN IF NOT EXISTS ai_classified_at timestamptz;
