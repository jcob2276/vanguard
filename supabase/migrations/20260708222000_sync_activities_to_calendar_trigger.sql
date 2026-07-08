-- Triggers for syncing workouts, strava activities and oura sleep into the vanguard_calendar table

-- 1. Sync workout_sessions (Sauna / Gym) to calendar
CREATE OR REPLACE FUNCTION public.trg_sync_workout_session_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_is_sauna boolean;
  v_summary text;
  v_category text;
  v_start timestamptz;
  v_end timestamptz;
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

  v_start := COALESCE(NEW.start_time, NEW.date::timestamp with time zone);
  v_end := COALESCE(NEW.end_time, v_start + (COALESCE(NEW.duration_minutes, 60) * interval '1 minute'));

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

CREATE OR REPLACE TRIGGER sync_workout_session_to_calendar_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_workout_session_to_calendar();


-- 2. Sync strava_activities (Running) to calendar
CREATE OR REPLACE FUNCTION public.trg_sync_strava_activity_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_summary text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'strava_activity_' || OLD.strava_id;
    RETURN OLD;
  END IF;

  -- Skip Oura duplicates
  IF COALESCE(NEW.is_oura_duplicate, false) = true THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'strava_activity_' || NEW.strava_id;
    RETURN NEW;
  END IF;

  v_summary := 'Bieg 🏃 (' || COALESCE(NEW.name, 'Strava') || ')';
  v_start := NEW.start_date;
  v_end := NEW.start_date + (COALESCE(NEW.elapsed_time, 3600) * interval '1 second');

  INSERT INTO public.vanguard_calendar (user_id, event_id, summary, start_time, end_time, category)
  VALUES (
    NEW.user_id,
    'strava_activity_' || NEW.strava_id,
    v_summary,
    v_start,
    v_end,
    'cialo_trening'
  )
  ON CONFLICT (event_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    category = EXCLUDED.category;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER sync_strava_activity_to_calendar_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.strava_activities
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_strava_activity_to_calendar();


-- 3. Sync oura_daily_summary (Sleep) to calendar
CREATE OR REPLACE FUNCTION public.trg_sync_oura_sleep_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'oura_sleep_' || OLD.user_id || '_' || OLD.date;
    RETURN OLD;
  END IF;

  -- Only sync if bedtime and duration are present
  IF NEW.bedtime_timestamp IS NULL OR NEW.total_sleep_hours IS NULL THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'oura_sleep_' || NEW.user_id || '_' || NEW.date;
    RETURN NEW;
  END IF;

  v_start := NEW.bedtime_timestamp;
  v_end := NEW.bedtime_timestamp + (NEW.total_sleep_hours * interval '1 hour');

  INSERT INTO public.vanguard_calendar (user_id, event_id, summary, start_time, end_time, category)
  VALUES (
    NEW.user_id,
    'oura_sleep_' || NEW.user_id || '_' || NEW.date,
    'Sen 🛌',
    v_start,
    v_end,
    'odpoczynek_regeneracja'
  )
  ON CONFLICT (event_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    category = EXCLUDED.category;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER sync_oura_sleep_to_calendar_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.oura_daily_summary
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_oura_sleep_to_calendar();
