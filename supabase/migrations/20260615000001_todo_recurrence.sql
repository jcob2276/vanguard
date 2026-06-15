-- Add recurrence support to todo_items.
-- Allows tasks to auto-spawn the next occurrence when completed.
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS recurrence text
    CHECK (recurrence IN ('daily', 'weekly', 'monthly'));
