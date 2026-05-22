-- Atomic workout save RPC used by the mobile workout flow.
-- Keeps workout_sessions and exercise_logs consistent in one transaction.

CREATE OR REPLACE FUNCTION public.save_workout_atomic(
  p_user_id uuid,
  p_day_key varchar,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text,
  p_msp_passed boolean,
  p_logs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_log jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to save workout for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id,
    workout_day,
    start_time,
    end_time,
    duration_minutes,
    session_notes,
    msp_passed
  )
  VALUES (
    p_user_id,
    p_day_key,
    p_start_time,
    p_end_time,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60))::integer,
    p_notes,
    COALESCE(p_msp_passed, false)
  )
  RETURNING id INTO v_session_id;

  FOR v_log IN SELECT * FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb))
  LOOP
    INSERT INTO public.exercise_logs (
      session_id,
      user_id,
      exercise_name,
      set_number,
      reps,
      weight,
      rpe
    )
    VALUES (
      v_session_id,
      p_user_id,
      v_log->>'exercise_name',
      (v_log->>'set_number')::integer,
      (v_log->>'reps')::integer,
      NULLIF(v_log->>'weight', '')::decimal,
      NULLIF(v_log->>'rpe', '')::decimal
    );
  END LOOP;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workout_atomic(
  uuid,
  varchar,
  timestamptz,
  timestamptz,
  text,
  boolean,
  jsonb
) TO authenticated;
