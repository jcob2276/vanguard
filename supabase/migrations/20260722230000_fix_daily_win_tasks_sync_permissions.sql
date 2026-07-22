-- Fix unique constraint violations (todo_items_user_id_section_id_title_key)
-- when syncing daily_win_tasks to todo_items or creating recurring todo_items.
-- Use sub-transaction EXCEPTION WHEN unique_violation to safely fall back or ignore collisions.

CREATE OR REPLACE FUNCTION public.sync_daily_win_tasks_to_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

  BEGIN
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
  EXCEPTION WHEN unique_violation THEN
    -- Fallback: if title collides with another todo in the section, update status/completed_at only
    UPDATE public.todo_items
    SET status = CASE WHEN NEW.done THEN 'done' ELSE 'open' END,
        completed_at = CASE WHEN NEW.done THEN COALESCE(NEW.completed_at, now()) ELSE NULL END
    WHERE id = NEW.todo_id
      AND (
        status IS DISTINCT FROM (CASE WHEN NEW.done THEN 'done' ELSE 'open' END)
        OR completed_at IS DISTINCT FROM (CASE WHEN NEW.done THEN COALESCE(NEW.completed_at, now()) ELSE NULL END)
      );
  END;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_daily_win_tasks_to_todo() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_todo_to_daily_win_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.sync_todo_to_daily_win_tasks() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_next_recurring_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  step interval;
  next_due date;
  origin uuid;
BEGIN
  IF OLD.status = 'done' OR NEW.status <> 'done' OR NEW.recurrence IS NULL OR NEW.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  step := CASE NEW.recurrence
    WHEN 'daily' THEN interval '1 day'
    WHEN 'weekly' THEN interval '1 week'
    WHEN 'monthly' THEN interval '1 month'
  END;
  next_due := (NEW.due_date + step)::date;
  origin := COALESCE(NEW.recurrence_origin_id, NEW.id);

  BEGIN
    INSERT INTO public.todo_items (
      user_id, section_id, project_id, title, notes, priority, tags, due_date,
      recurrence, duration_minutes, scheduled_time, reminder_at, is_important,
      parent_task_id, category, sort_order, recurrence_origin_id
    ) VALUES (
      NEW.user_id, NEW.section_id, NEW.project_id, NEW.title, NEW.notes, NEW.priority,
      NEW.tags, next_due, NEW.recurrence, NEW.duration_minutes,
      CASE WHEN NEW.scheduled_time IS NULL THEN NULL ELSE NEW.scheduled_time + step END,
      CASE WHEN NEW.reminder_at IS NULL THEN NULL ELSE NEW.reminder_at + step END,
      NEW.is_important, NEW.parent_task_id, NEW.category, NEW.sort_order, origin
    );
  EXCEPTION WHEN unique_violation THEN
    -- Silently handle duplicate title or recurrence instance collisions
    NULL;
  END;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_next_recurring_todo() TO authenticated, service_role;
