-- Atomic morning plan: daily_wins + daily_win_tasks + todo schedule in one transaction.
-- Calendar (Google) stays best-effort in the app after this RPC succeeds.

CREATE OR REPLACE FUNCTION public.submit_morning_plan(
  p_user_id uuid,
  p_date date,
  p_slots jsonb DEFAULT '[]'::jsonb,
  p_schedules jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_win_id uuid;
  r jsonb;
BEGIN
  IF p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'submit_morning_plan: forbidden';
  END IF;

  INSERT INTO public.daily_wins (user_id, date, result)
  VALUES (p_user_id, p_date, NULL)
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT id INTO v_win_id
  FROM public.daily_wins
  WHERE user_id = p_user_id AND date = p_date;

  IF v_win_id IS NULL THEN
    RAISE EXCEPTION 'submit_morning_plan: daily_wins row missing';
  END IF;

  DELETE FROM public.daily_win_tasks WHERE day_win_id = v_win_id;

  FOR r IN SELECT value FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb))
  LOOP
    INSERT INTO public.daily_win_tasks (
      day_win_id, user_id, slot, title, category, todo_id, done
    ) VALUES (
      v_win_id,
      p_user_id,
      (r->>'slot')::integer,
      r->>'title',
      COALESCE(NULLIF(r->>'category', ''), 'general'),
      NULLIF(r->>'todo_id', '')::uuid,
      false
    );
  END LOOP;

  FOR r IN SELECT value FROM jsonb_array_elements(COALESCE(p_schedules, '[]'::jsonb))
  LOOP
    UPDATE public.todo_items
    SET
      scheduled_time = NULLIF(r->>'scheduled_time', '')::timestamptz,
      duration_minutes = NULLIF(r->>'duration_minutes', '')::integer,
      due_date = p_date
    WHERE id = (r->>'todo_id')::uuid
      AND user_id = p_user_id;
  END LOOP;

  RETURN v_win_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_morning_plan(uuid, date, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_morning_plan(uuid, date, jsonb, jsonb) TO authenticated;
