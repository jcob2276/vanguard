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
  v_set_count integer;
  v_avg_rir decimal;
  v_importance integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to save workout for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id, workout_day, date,
    start_time, end_time, duration_minutes,
    session_notes, msp_passed
  )
  VALUES (
    p_user_id,
    p_day_key,
    COALESCE((p_start_time AT TIME ZONE 'Europe/Warsaw')::date, (now() AT TIME ZONE 'Europe/Warsaw')::date),
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
      session_id, user_id, exercise_name, set_number,
      reps, weight, rpe, rir, is_pws_or_msp, muscle_tags
    )
    VALUES (
      v_session_id,
      p_user_id,
      v_log->>'exercise_name',
      (v_log->>'set_number')::integer,
      (v_log->>'reps')::integer,
      NULLIF(v_log->>'weight', '')::decimal,
      NULLIF(v_log->>'rpe', '')::decimal,
      NULLIF(v_log->>'rir', '')::decimal,
      COALESCE((v_log->>'is_pws_or_msp')::boolean, false),
      CASE
        WHEN jsonb_typeof(v_log->'muscle_tags') = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(v_log->'muscle_tags'))
        ELSE '{}'::text[]
      END
    );
  END LOOP;

  SELECT COUNT(*), AVG(NULLIF(el->>'rir', '')::decimal)
  INTO v_set_count, v_avg_rir
  FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb)) el;

  v_importance := 5;
  IF v_set_count >= 15 THEN v_importance := v_importance + 1;
  ELSIF v_set_count <= 4 THEN v_importance := v_importance - 1;
  END IF;
  IF COALESCE(p_msp_passed, false) THEN v_importance := v_importance + 1; END IF;
  IF v_avg_rir IS NOT NULL THEN
    IF v_avg_rir < 1 THEN v_importance := v_importance + 1;
    ELSIF v_avg_rir > 3 THEN v_importance := v_importance - 1;
    END IF;
  END IF;
  v_importance := GREATEST(1, LEAST(10, v_importance));

  UPDATE public.workout_sessions SET importance_score = v_importance WHERE id = v_session_id;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_workout_atomic(
  p_user_id    uuid,
  p_day_key    varchar,
  p_start_time timestamptz,
  p_end_time   timestamptz,
  p_notes      text,
  p_msp_passed boolean,
  p_logs       jsonb,
  p_session_rpe integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_log        jsonb;
  v_set_count  integer;
  v_avg_rir    decimal;
  v_importance integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to save workout for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id, workout_day, date,
    start_time, end_time, duration_minutes,
    session_notes, msp_passed, session_rpe
  )
  VALUES (
    p_user_id,
    p_day_key,
    COALESCE((p_start_time AT TIME ZONE 'Europe/Warsaw')::date, (now() AT TIME ZONE 'Europe/Warsaw')::date),
    p_start_time,
    p_end_time,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60))::integer,
    p_notes,
    COALESCE(p_msp_passed, false),
    p_session_rpe
  )
  RETURNING id INTO v_session_id;

  FOR v_log IN SELECT * FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb))
  LOOP
    INSERT INTO public.exercise_logs (
      session_id, user_id, exercise_name, set_number,
      reps, weight, rpe, rir, is_pws_or_msp, muscle_tags
    )
    VALUES (
      v_session_id,
      p_user_id,
      v_log->>'exercise_name',
      (v_log->>'set_number')::integer,
      (v_log->>'reps')::integer,
      NULLIF(v_log->>'weight', '')::decimal,
      NULLIF(v_log->>'rpe', '')::decimal,
      NULLIF(v_log->>'rir', '')::decimal,
      COALESCE((v_log->>'is_pws_or_msp')::boolean, false),
      CASE
        WHEN jsonb_typeof(v_log->'muscle_tags') = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(v_log->'muscle_tags'))
        ELSE '{}'::text[]
      END
    );
  END LOOP;

  SELECT COUNT(*), AVG(NULLIF(el->>'rir', '')::decimal)
  INTO v_set_count, v_avg_rir
  FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb)) el;

  v_importance := 5;
  IF v_set_count >= 15 THEN v_importance := v_importance + 1;
  ELSIF v_set_count <= 4 THEN v_importance := v_importance - 1;
  END IF;
  IF COALESCE(p_msp_passed, false) THEN v_importance := v_importance + 1; END IF;
  IF v_avg_rir IS NOT NULL THEN
    IF v_avg_rir < 1 THEN v_importance := v_importance + 1;
    ELSIF v_avg_rir > 3 THEN v_importance := v_importance - 1;
    END IF;
  END IF;
  IF p_session_rpe IS NOT NULL THEN
    IF p_session_rpe >= 9 THEN v_importance := v_importance + 1;
    ELSIF p_session_rpe <= 4 THEN v_importance := v_importance - 1;
    END IF;
  END IF;
  v_importance := GREATEST(1, LEAST(10, v_importance));

  UPDATE public.workout_sessions SET importance_score = v_importance WHERE id = v_session_id;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workout_atomic(
  uuid, varchar, timestamptz, timestamptz, text, boolean, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_workout_atomic(
  uuid, varchar, timestamptz, timestamptz, text, boolean, jsonb, integer
) TO authenticated;
