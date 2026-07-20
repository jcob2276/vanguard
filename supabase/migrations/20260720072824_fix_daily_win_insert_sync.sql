-- Morning plan recreates daily_win_tasks from todo snapshots. INSERT must not
-- write those snapshots back to todo_items: a stale title can collide with the
-- canonical (user_id, section_id, title) uniqueness constraint.
CREATE OR REPLACE FUNCTION public.sync_daily_win_tasks_to_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.todo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.done IS DISTINCT FROM OLD.done
    OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.todo_items
  SET title = NEW.title,
      status = CASE WHEN NEW.done THEN 'done' ELSE 'open' END,
      completed_at = CASE WHEN NEW.done THEN COALESCE(NEW.completed_at, now()) ELSE NULL END
  WHERE id = NEW.todo_id
    AND (
      title IS DISTINCT FROM NEW.title
      OR status IS DISTINCT FROM (CASE WHEN NEW.done THEN 'done' ELSE 'open' END)
      OR completed_at IS DISTINCT FROM (CASE WHEN NEW.done THEN COALESCE(NEW.completed_at, now()) ELSE NULL END)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_daily_win_tasks_to_todo ON public.daily_win_tasks;
CREATE TRIGGER trg_sync_daily_win_tasks_to_todo
AFTER UPDATE OF title, done, completed_at ON public.daily_win_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_win_tasks_to_todo();

REVOKE ALL ON FUNCTION public.sync_daily_win_tasks_to_todo() FROM PUBLIC, anon, authenticated;
