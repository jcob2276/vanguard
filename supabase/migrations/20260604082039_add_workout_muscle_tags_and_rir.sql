-- Persist muscle tags selected in the mobile workout logger.
-- Keep legacy exercise_logs.rpe as the existing near-failure/MSP scale for compatibility.

ALTER TABLE public.exercise_logs
ADD COLUMN IF NOT EXISTS muscle_tags text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS rir decimal(3,1);

COMMENT ON COLUMN public.exercise_logs.muscle_tags IS
  'Muscle tags captured at workout save time. Used by MuscleHeatmap instead of re-deriving tags from exercise_name.';

COMMENT ON COLUMN public.exercise_logs.rir IS
  'Reps in reserve for the set. Legacy rpe remains populated for existing strain/MSP compatibility.';

CREATE INDEX IF NOT EXISTS idx_exercise_logs_muscle_tags
  ON public.exercise_logs USING gin(muscle_tags);

-- Backfill existing workout logs so historical sessions participate in the new heatmap.
-- Only empty muscle_tags are filled; manually captured tags from newer clients are left intact.
WITH candidates AS (
  SELECT
    id,
    lower(exercise_name) AS n
  FROM public.exercise_logs
  WHERE COALESCE(array_length(muscle_tags, 1), 0) = 0
),
mapped AS (
  SELECT
    id,
    CASE
      WHEN n LIKE '%wyciskanie wąskim%' OR n LIKE '%close-grip%' OR n LIKE '%cg bench%' THEN ARRAY['triceps','klatka']::text[]
      WHEN n LIKE '%wyciskanie płaskie%' OR n LIKE '%wyciskanie%sztangi%ławce%' OR n LIKE '%wyciskanie%hantli%ławce%' OR n LIKE '%bench%' THEN ARRAY['klatka','triceps','barki']::text[]
      WHEN n LIKE '%skos%' OR n LIKE '%incline%' OR n LIKE '%skośn%' THEN ARRAY['klatka','barki']::text[]
      WHEN n LIKE '%rozpi%' OR n LIKE '%fly%' OR n LIKE '%crossover%' THEN ARRAY['klatka']::text[]
      WHEN n LIKE '%pompki%' OR n LIKE '%push-up%' THEN ARRAY['klatka','triceps']::text[]
      WHEN n LIKE '%dips%' OR n LIKE '%dipy%' THEN ARRAY['klatka','triceps']::text[]

      WHEN n LIKE '%overh.%triceps%' OR n LIKE '%overhead triceps%' OR n LIKE '%pushdown%' OR n LIKE '%prostowanie łokci%' OR n LIKE '%prostowanie lokci%' OR n LIKE '%french press%' OR n LIKE '%skull crusher%' THEN ARRAY['triceps']::text[]
      WHEN n LIKE '%ohp%' OR n LIKE '%arnold press%' THEN ARRAY['barki','triceps']::text[]
      WHEN n LIKE '%unoszenie boczne%' OR n LIKE '%unoszenie przednie%' OR n LIKE '%wznosy bokiem%' OR n LIKE '%lateral raise%' THEN ARRAY['barki']::text[]
      WHEN n LIKE '%face pull%' OR n LIKE '%face pulls%' THEN ARRAY['plecy','barki']::text[]
      WHEN n LIKE '%rear delt%' THEN ARRAY['barki','plecy']::text[]

      WHEN n LIKE '%pull-up%' OR n LIKE '%podciąg%' OR n LIKE '%podciag%' OR n LIKE '%lat pulldown%' OR n LIKE '%ściąganie%' OR n LIKE '%sciaganie%' OR n LIKE '%drążk%' OR n LIKE '%drazk%' THEN ARRAY['plecy','biceps']::text[]
      WHEN n LIKE '%wiosł%' OR n LIKE '%wiosl%' OR n LIKE '% row%' OR n LIKE '%seal row%' OR n LIKE '%chest supported row%' OR n LIKE '%chest-supported row%' THEN ARRAY['plecy','biceps']::text[]
      WHEN n LIKE '%martwy ciąg rumuński%' OR n LIKE '%martwy ciag rumunski%' OR n = 'rdl' OR n LIKE '% rdl%' THEN ARRAY['dwugłowe ud','pośladki','plecy']::text[]
      WHEN n LIKE '%martwy ciąg%' OR n LIKE '%martwy ciag%' OR n LIKE '%deadlift%' THEN ARRAY['plecy','nogi','pośladki']::text[]
      WHEN n LIKE '%good morning%' THEN ARRAY['dwugłowe ud','pośladki','plecy']::text[]

      WHEN n LIKE '%przysiad%' OR n LIKE '%squat%' THEN ARRAY['czworogłowe','pośladki','dwugłowe ud']::text[]
      WHEN n LIKE '%leg press%' THEN ARRAY['czworogłowe','pośladki']::text[]
      WHEN n LIKE '%wykroki%' OR n LIKE '%lunge%' THEN ARRAY['czworogłowe','pośladki']::text[]
      WHEN n LIKE '%prostowanie nóg%' OR n LIKE '%prostowanie nog%' OR n LIKE '%leg extension%' THEN ARRAY['czworogłowe']::text[]
      WHEN n LIKE '%zginanie nóg%' OR n LIKE '%zginanie nog%' OR n LIKE '%leg curl%' THEN ARRAY['dwugłowe ud']::text[]
      WHEN n LIKE '%hip thrust%' OR n LIKE '%glute bridge%' THEN ARRAY['pośladki','dwugłowe ud']::text[]
      WHEN n LIKE '%wspięcia%' OR n LIKE '%wspiecia%' OR n LIKE '%calf%' OR n LIKE '%łydk%' OR n LIKE '%lydk%' THEN ARRAY['łydki']::text[]

      WHEN n LIKE '%uginanie młotkowe%' OR n LIKE '%uginanie mlotkowe%' THEN ARRAY['biceps','przedramiona']::text[]
      WHEN n LIKE '%uginanie%' OR n LIKE '%curl%' THEN ARRAY['biceps']::text[]
      WHEN n LIKE '%plank%' OR n LIKE '%crunch%' OR n LIKE '%hanging leg raise%' OR n LIKE '%ab rollout%' OR n LIKE '%ab wheel%' OR n LIKE '%dragon flag%' OR n LIKE '%pallof%' OR n LIKE '%dead bug%' THEN ARRAY['brzuch']::text[]

      WHEN n LIKE '%kettlebell swing%' THEN ARRAY['pośladki','plecy','cardio']::text[]
      WHEN n LIKE '%wioślarz%' OR n LIKE '%wioslarz%' OR n LIKE '%ergometr%' THEN ARRAY['cardio','plecy']::text[]
      WHEN n LIKE '%rower%' OR n LIKE '%bieżnia%' OR n LIKE '%bieznia%' THEN ARRAY['cardio']::text[]
      ELSE '{}'::text[]
    END AS tags
  FROM candidates
)
UPDATE public.exercise_logs AS el
SET muscle_tags = mapped.tags
FROM mapped
WHERE el.id = mapped.id
  AND COALESCE(array_length(mapped.tags, 1), 0) > 0;

UPDATE public.exercise_logs
SET rir = rpe
WHERE rir IS NULL
  AND rpe IS NOT NULL;

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
      rpe,
      rir,
      muscle_tags
    )
    VALUES (
      v_session_id,
      p_user_id,
      v_log->>'exercise_name',
      (v_log->>'set_number')::integer,
      (v_log->>'reps')::integer,
      NULLIF(v_log->>'weight', '')::decimal,
      NULLIF(COALESCE(v_log->>'rpe', v_log->>'rir'), '')::decimal,
      NULLIF(v_log->>'rir', '')::decimal,
      CASE
        WHEN jsonb_typeof(v_log->'muscle_tags') = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(v_log->'muscle_tags'))
        ELSE '{}'::text[]
      END
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
