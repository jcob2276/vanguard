-- Separate the day chosen for doing a task from its hard deadline.
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS deadline_date date,
  ADD COLUMN IF NOT EXISTS recurrence_origin_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL;

ALTER TABLE public.todo_items DROP CONSTRAINT IF EXISTS todo_items_recurrence_format;
ALTER TABLE public.todo_items ADD CONSTRAINT todo_items_recurrence_format CHECK (
  recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly')
);

CREATE OR REPLACE FUNCTION public.create_next_recurring_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  next_due date;
  day_step integer;
  month_step integer;
  next_scheduled timestamptz;
  next_reminder timestamptz;
  origin uuid;
BEGIN
  IF OLD.status = 'done' OR NEW.status <> 'done' OR NEW.recurrence IS NULL OR NEW.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  day_step := CASE NEW.recurrence
    WHEN 'daily' THEN 1 WHEN 'weekly' THEN 7 WHEN 'biweekly' THEN 14 ELSE NULL
  END;
  month_step := CASE WHEN NEW.recurrence = 'monthly' THEN 1 ELSE NULL END;

  IF NEW.recurrence = 'weekdays' THEN
    next_due := NEW.due_date + 1;
    WHILE EXTRACT(ISODOW FROM next_due) > 5 LOOP next_due := next_due + 1; END LOOP;
  ELSIF month_step IS NOT NULL THEN
    next_due := (NEW.due_date + make_interval(months => month_step))::date;
  ELSE
    next_due := NEW.due_date + day_step;
  END IF;

  next_scheduled := CASE WHEN NEW.scheduled_time IS NULL THEN NULL
    ELSE NEW.scheduled_time + (next_due - NEW.due_date) * interval '1 day' END;
  next_reminder := CASE WHEN NEW.reminder_at IS NULL THEN NULL
    ELSE NEW.reminder_at + (next_due - NEW.due_date) * interval '1 day' END;
  origin := COALESCE(NEW.recurrence_origin_id, NEW.id);

  INSERT INTO public.todo_items (
    user_id, section_id, project_id, title, notes, priority, tags, due_date, deadline_date,
    recurrence, duration_minutes, scheduled_time, reminder_at, is_important,
    parent_task_id, category, sort_order, recurrence_origin_id
  ) VALUES (
    NEW.user_id, NEW.section_id, NEW.project_id, NEW.title, NEW.notes, NEW.priority,
    NEW.tags, next_due,
    CASE WHEN NEW.deadline_date IS NULL THEN NULL ELSE NEW.deadline_date + (next_due - NEW.due_date) END,
    NEW.recurrence, NEW.duration_minutes, next_scheduled, next_reminder,
    NEW.is_important, NEW.parent_task_id, NEW.category, NEW.sort_order, origin
  ) ON CONFLICT (recurrence_origin_id, due_date)
    WHERE recurrence_origin_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;
