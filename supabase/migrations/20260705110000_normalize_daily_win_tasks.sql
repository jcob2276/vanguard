-- Migration: Normalize daily_wins tasks to daily_win_tasks

CREATE TABLE IF NOT EXISTS public.daily_win_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_win_id UUID NOT NULL REFERENCES public.daily_wins(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done BOOLEAN DEFAULT false,
    category TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    todo_id UUID,
    checkpoint_id UUID,
    pin_id UUID,
    project_id UUID,
    target_value TEXT,
    time_slot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_win_tasks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own tasks
CREATE POLICY manage_own_daily_win_tasks ON public.daily_win_tasks
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Initial migration: backfill existing data from daily_wins columns
DO $$
DECLARE
    r RECORD;
    v_user_id UUID;
BEGIN
    FOR r IN SELECT * FROM public.daily_wins LOOP
        v_user_id := r.user_id;
        IF v_user_id IS NULL THEN
            SELECT id INTO v_user_id FROM auth.users LIMIT 1;
        END IF;
        
        IF v_user_id IS NOT NULL THEN
            -- Slot 1
            IF r.task_1 IS NOT NULL AND r.task_1 <> '' THEN
                INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
                VALUES (r.id, 1, v_user_id, r.task_1, COALESCE(r.done_1, false), r.category_1, r.completed_at_1::timestamptz, r.task_1_todo_id, r.task_1_checkpoint_id, r.task_1_pin_id, r.task_1_project_id, r.task_1_target_value, r.task_1_time_slot);
            END IF;
            -- Slot 2
            IF r.task_2 IS NOT NULL AND r.task_2 <> '' THEN
                INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
                VALUES (r.id, 2, v_user_id, r.task_2, COALESCE(r.done_2, false), r.category_2, r.completed_at_2::timestamptz, r.task_2_todo_id, r.task_2_checkpoint_id, r.task_2_pin_id, r.task_2_project_id, r.task_2_target_value, r.task_2_time_slot);
            END IF;
            -- Slot 3
            IF r.task_3 IS NOT NULL AND r.task_3 <> '' THEN
                INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
                VALUES (r.id, 3, v_user_id, r.task_3, COALESCE(r.done_3, false), r.category_3, r.completed_at_3::timestamptz, r.task_3_todo_id, r.task_3_checkpoint_id, r.task_3_pin_id, r.task_3_project_id, r.task_3_target_value, r.task_3_time_slot);
            END IF;
            -- Slot 4
            IF r.task_4 IS NOT NULL AND r.task_4 <> '' THEN
                INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
                VALUES (r.id, 4, v_user_id, r.task_4, COALESCE(r.done_4, false), r.category_4, r.completed_at_4::timestamptz, r.task_4_todo_id, r.task_4_checkpoint_id, r.task_4_pin_id, r.task_4_project_id, r.task_4_target_value, r.task_4_time_slot);
            END IF;
            -- Slot 5
            IF r.task_5 IS NOT NULL AND r.task_5 <> '' THEN
                INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
                VALUES (r.id, 5, v_user_id, r.task_5, COALESCE(r.done_5, false), r.category_5, r.completed_at_5::timestamptz, r.task_5_todo_id, r.task_5_checkpoint_id, r.task_5_pin_id, r.task_5_project_id, r.task_5_target_value, r.task_5_time_slot);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Triggers for bidirectional synchronization and backward compatibility

-- 1. sync_daily_win_tasks_to_daily_wins
CREATE OR REPLACE FUNCTION public.sync_daily_win_tasks_to_daily_wins()
RETURNS TRIGGER AS $$
DECLARE
    v_day_win_id UUID;
    r_task RECORD;
    i INTEGER := 1;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        v_day_win_id := OLD.day_win_id;
    ELSE
        v_day_win_id := NEW.day_win_id;
    END IF;

    -- Reset all task fields in daily_wins
    UPDATE public.daily_wins
    SET
        task_1 = NULL, done_1 = NULL, category_1 = NULL, completed_at_1 = NULL, task_1_todo_id = NULL, task_1_checkpoint_id = NULL, task_1_pin_id = NULL, task_1_project_id = NULL, task_1_target_value = NULL, task_1_time_slot = NULL,
        task_2 = NULL, done_2 = NULL, category_2 = NULL, completed_at_2 = NULL, task_2_todo_id = NULL, task_2_checkpoint_id = NULL, task_2_pin_id = NULL, task_2_project_id = NULL, task_2_target_value = NULL, task_2_time_slot = NULL,
        task_3 = NULL, done_3 = NULL, category_3 = NULL, completed_at_3 = NULL, task_3_todo_id = NULL, task_3_checkpoint_id = NULL, task_3_pin_id = NULL, task_3_project_id = NULL, task_3_target_value = NULL, task_3_time_slot = NULL,
        task_4 = NULL, done_4 = NULL, category_4 = NULL, completed_at_4 = NULL, task_4_todo_id = NULL, task_4_checkpoint_id = NULL, task_4_pin_id = NULL, task_4_project_id = NULL, task_4_target_value = NULL, task_4_time_slot = NULL,
        task_5 = NULL, done_5 = NULL, category_5 = NULL, completed_at_5 = NULL, task_5_todo_id = NULL, task_5_checkpoint_id = NULL, task_5_pin_id = NULL, task_5_project_id = NULL, task_5_target_value = NULL, task_5_time_slot = NULL
    WHERE id = v_day_win_id;

    -- Refill task fields in daily_wins with current active tasks
    FOR r_task IN (
        SELECT * FROM public.daily_win_tasks
        WHERE day_win_id = v_day_win_id
        ORDER BY slot ASC, created_at ASC
        LIMIT 5
    ) LOOP
        IF i = 1 THEN
            UPDATE public.daily_wins SET
                task_1 = r_task.title, done_1 = r_task.done, category_1 = r_task.category, completed_at_1 = r_task.completed_at::text,
                task_1_todo_id = r_task.todo_id, task_1_checkpoint_id = r_task.checkpoint_id, task_1_pin_id = r_task.pin_id,
                task_1_project_id = r_task.project_id, task_1_target_value = r_task.target_value, task_1_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 2 THEN
            UPDATE public.daily_wins SET
                task_2 = r_task.title, done_2 = r_task.done, category_2 = r_task.category, completed_at_2 = r_task.completed_at::text,
                task_2_todo_id = r_task.todo_id, task_2_checkpoint_id = r_task.checkpoint_id, task_2_pin_id = r_task.pin_id,
                task_2_project_id = r_task.project_id, task_2_target_value = r_task.target_value, task_2_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 3 THEN
            UPDATE public.daily_wins SET
                task_3 = r_task.title, done_3 = r_task.done, category_3 = r_task.category, completed_at_3 = r_task.completed_at::text,
                task_3_todo_id = r_task.todo_id, task_3_checkpoint_id = r_task.checkpoint_id, task_3_pin_id = r_task.pin_id,
                task_3_project_id = r_task.project_id, task_3_target_value = r_task.target_value, task_3_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 4 THEN
            UPDATE public.daily_wins SET
                task_4 = r_task.title, done_4 = r_task.done, category_4 = r_task.category, completed_at_4 = r_task.completed_at::text,
                task_4_todo_id = r_task.todo_id, task_4_checkpoint_id = r_task.checkpoint_id, task_4_pin_id = r_task.pin_id,
                task_4_project_id = r_task.project_id, task_4_target_value = r_task.target_value, task_4_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 5 THEN
            UPDATE public.daily_wins SET
                task_5 = r_task.title, done_5 = r_task.done, category_5 = r_task.category, completed_at_5 = r_task.completed_at::text,
                task_5_todo_id = r_task.todo_id, task_5_checkpoint_id = r_task.checkpoint_id, task_5_pin_id = r_task.pin_id,
                task_5_project_id = r_task.project_id, task_5_target_value = r_task.target_value, task_5_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        END IF;
        i := i + 1;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_daily_win_tasks ON public.daily_win_tasks;
CREATE TRIGGER trg_sync_daily_win_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.daily_win_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_daily_win_tasks_to_daily_wins();


-- 2. sync_daily_wins_to_daily_win_tasks
CREATE OR REPLACE FUNCTION public.sync_daily_wins_to_daily_win_tasks()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    v_user_id := COALESCE(NEW.user_id, auth.uid());
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;

    IF v_user_id IS NOT NULL THEN
        -- Clear previous entries to prevent duplicate conflicts
        DELETE FROM public.daily_win_tasks WHERE day_win_id = NEW.id;

        -- Slot 1
        IF NEW.task_1 IS NOT NULL AND NEW.task_1 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 1, v_user_id, NEW.task_1, COALESCE(NEW.done_1, false), NEW.category_1, NEW.completed_at_1::timestamptz, NEW.task_1_todo_id, NEW.task_1_checkpoint_id, NEW.task_1_pin_id, NEW.task_1_project_id, NEW.task_1_target_value, NEW.task_1_time_slot);
        END IF;
        -- Slot 2
        IF NEW.task_2 IS NOT NULL AND NEW.task_2 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 2, v_user_id, NEW.task_2, COALESCE(NEW.done_2, false), NEW.category_2, NEW.completed_at_2::timestamptz, NEW.task_2_todo_id, NEW.task_2_checkpoint_id, NEW.task_2_pin_id, NEW.task_2_project_id, NEW.task_2_target_value, NEW.task_2_time_slot);
        END IF;
        -- Slot 3
        IF NEW.task_3 IS NOT NULL AND NEW.task_3 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 3, v_user_id, NEW.task_3, COALESCE(NEW.done_3, false), NEW.category_3, NEW.completed_at_3::timestamptz, NEW.task_3_todo_id, NEW.task_3_checkpoint_id, NEW.task_3_pin_id, NEW.task_3_project_id, NEW.task_3_target_value, NEW.task_3_time_slot);
        END IF;
        -- Slot 4
        IF NEW.task_4 IS NOT NULL AND NEW.task_4 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 4, v_user_id, NEW.task_4, COALESCE(NEW.done_4, false), NEW.category_4, NEW.completed_at_4::timestamptz, NEW.task_4_todo_id, NEW.task_4_checkpoint_id, NEW.task_4_pin_id, NEW.task_4_project_id, NEW.task_4_target_value, NEW.task_4_time_slot);
        END IF;
        -- Slot 5
        IF NEW.task_5 IS NOT NULL AND NEW.task_5 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 5, v_user_id, NEW.task_5, COALESCE(NEW.done_5, false), NEW.category_5, NEW.completed_at_5::timestamptz, NEW.task_5_todo_id, NEW.task_5_checkpoint_id, NEW.task_5_pin_id, NEW.task_5_project_id, NEW.task_5_target_value, NEW.task_5_time_slot);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_daily_wins ON public.daily_wins;
CREATE TRIGGER trg_sync_daily_wins
AFTER INSERT OR UPDATE ON public.daily_wins
FOR EACH ROW EXECUTE FUNCTION public.sync_daily_wins_to_daily_win_tasks();
