-- One scheduling contract for every task entry point and real recurring instances.
UPDATE public.todo_items
SET due_date = (scheduled_time AT TIME ZONE 'Europe/Warsaw')::date
WHERE scheduled_time IS NOT NULL AND due_date IS NULL;

UPDATE public.todo_items SET recurrence = NULL
WHERE recurrence IS NOT NULL AND due_date IS NULL;

UPDATE public.todo_items SET duration_minutes = NULL
WHERE duration_minutes IS NOT NULL AND (duration_minutes < 5 OR duration_minutes > 1440);

UPDATE public.todo_items SET title = 'Bez tytułu'
WHERE btrim(title) = '';

ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS recurrence_origin_id uuid REFERENCES public.todo_items(id) ON DELETE SET NULL,
  ADD CONSTRAINT todo_items_title_not_blank CHECK (btrim(title) <> ''),
  ADD CONSTRAINT todo_items_scheduled_requires_due_date CHECK (scheduled_time IS NULL OR due_date IS NOT NULL),
  ADD CONSTRAINT todo_items_recurrence_requires_due_date CHECK (recurrence IS NULL OR due_date IS NOT NULL),
  ADD CONSTRAINT todo_items_duration_range CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 1440);

CREATE UNIQUE INDEX IF NOT EXISTS todo_items_recurrence_instance_unique
  ON public.todo_items (recurrence_origin_id, due_date)
  WHERE recurrence_origin_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_next_recurring_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
  ) ON CONFLICT (recurrence_origin_id, due_date)
    WHERE recurrence_origin_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS todo_items_create_next_recurrence ON public.todo_items;
CREATE TRIGGER todo_items_create_next_recurrence
AFTER UPDATE OF status ON public.todo_items
FOR EACH ROW EXECUTE FUNCTION public.create_next_recurring_todo();
