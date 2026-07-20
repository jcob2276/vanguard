-- Bidirectional task sync: Power List (daily_win_tasks) → todo_items.
-- Complements sync_todo_to_daily_win_tasks (todo → daily_win_tasks).
-- Guard pg_trigger_depth > 1 so todo→daily_win_tasks writes do not bounce back.

CREATE OR REPLACE FUNCTION public.sync_daily_win_tasks_to_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.todo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
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
AFTER INSERT OR UPDATE OF title, done, completed_at ON public.daily_win_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_win_tasks_to_todo();

REVOKE ALL ON FUNCTION public.sync_daily_win_tasks_to_todo() FROM PUBLIC, anon, authenticated;
