-- Fix trigger to fallback to created_at when start_time is null and query exercise_logs reps for duration when duration_minutes is 0/null

CREATE OR REPLACE FUNCTION public.trg_sync_workout_session_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_is_sauna boolean;
  v_summary text;
  v_category text;
  v_start timestamptz;
  v_end timestamptz;
  v_duration_min integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'workout_session_' || OLD.id;
    RETURN OLD;
  END IF;

  -- Check if any log in this session is sauna
  SELECT EXISTS (
    SELECT 1 FROM public.exercise_logs
    WHERE session_id = NEW.id AND exercise_name ILIKE '%sauna%'
  ) INTO v_is_sauna;

  IF v_is_sauna OR NEW.workout_day ILIKE '%sauna%' OR NEW.workout_day ILIKE '%wellness%' THEN
    v_summary := 'Sauna 🧖';
    v_category := 'odpoczynek_regeneracja';
  ELSE
    v_summary := 'Siłownia 🏋️';
    v_category := 'cialo_trening';
  END IF;

  -- Fallback to created_at if start_time is NULL
  v_start := COALESCE(NEW.start_time, NEW.created_at, NEW.date::timestamp with time zone);

  -- Fallback to exercise logs reps (e.g. sauna minutes) if duration_minutes is 0 or NULL
  IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes > 0 THEN
    v_duration_min := NEW.duration_minutes;
  ELSE
    SELECT COALESCE(SUM(reps), 60) INTO v_duration_min
    FROM public.exercise_logs
    WHERE session_id = NEW.id;
  END IF;

  IF v_duration_min IS NULL OR v_duration_min <= 0 THEN
    v_duration_min := 60;
  END IF;

  v_end := COALESCE(NEW.end_time, v_start + (v_duration_min * interval '1 minute'));

  INSERT INTO public.vanguard_calendar (user_id, event_id, summary, start_time, end_time, category)
  VALUES (
    NEW.user_id,
    'workout_session_' || NEW.id,
    v_summary,
    v_start,
    v_end,
    v_category
  )
  ON CONFLICT (event_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    category = EXCLUDED.category;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
