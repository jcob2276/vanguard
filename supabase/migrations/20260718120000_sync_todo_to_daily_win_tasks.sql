-- A daily Top 5 entry and its Todo card are the same task. Keep completion and
-- title changes made from any Todo surface in sync with the active daily plan.
CREATE OR REPLACE FUNCTION public.sync_todo_to_daily_win_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    UPDATE public.daily_win_tasks
    SET title = NEW.title,
        done = NEW.status = 'done',
        completed_at = CASE WHEN NEW.status = 'done' THEN COALESCE(NEW.completed_at, now()) ELSE NULL END
    WHERE todo_id = NEW.id
      AND (title IS DISTINCT FROM NEW.title
        OR done IS DISTINCT FROM (NEW.status = 'done')
        OR completed_at IS DISTINCT FROM CASE WHEN NEW.status = 'done' THEN COALESCE(NEW.completed_at, now()) ELSE NULL END);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_todo_to_daily_win_tasks ON public.todo_items;
CREATE TRIGGER trg_sync_todo_to_daily_win_tasks
AFTER UPDATE OF title, status, completed_at ON public.todo_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_todo_to_daily_win_tasks();

REVOKE ALL ON FUNCTION public.sync_todo_to_daily_win_tasks() FROM PUBLIC, anon, authenticated;
