-- Desktop RPC: projects slice without dream_id (marzenia ≠ projekty).

CREATE OR REPLACE FUNCTION public.get_desktop_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to read dashboard data for this user'
      USING ERRCODE = '42501';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::date;

  SELECT jsonb_build_object(
    'oura', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, hrv_avg, rhr_avg, total_sleep_hours, readiness_score, sleep_score
        FROM public.oura_daily_summary
        WHERE user_id = p_user_id AND date >= (v_today - 60)
        ORDER BY date ASC
      ) sub
    ),
    'nutrition', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, calories, protein
        FROM public.daily_nutrition
        WHERE user_id = p_user_id AND date >= (v_today - 14)
        ORDER BY date ASC
      ) sub
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT ws.id, ws.date, ws.workout_day, ws.session_rpe,
          (
            SELECT COALESCE(jsonb_agg(el), '[]'::jsonb)
            FROM (
              SELECT exercise_name, weight, reps, muscle_tags, is_pws_or_msp, rir, rpe
              FROM public.exercise_logs
              WHERE session_id = ws.id
            ) el
          ) AS exercise_logs
        FROM public.workout_sessions ws
        WHERE ws.user_id = p_user_id AND ws.date::date >= (v_today - 91)
        ORDER BY ws.date ASC
      ) sub
    ),
    'body', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, weight, waist, neck, hips, body_fat
        FROM public.body_metrics
        WHERE user_id = p_user_id AND date >= (v_today - 90)
        ORDER BY date ASC
      ) sub
    ),
    'strain', (
      SELECT row_to_json(sub)::jsonb
      FROM (
        SELECT daily_status, main_limiter, strain_score, recovery_score, fueling_score, fueling_provisional
        FROM public.daily_strain
        WHERE user_id = p_user_id
        ORDER BY date DESC
        LIMIT 1
      ) sub
    ),
    'strava', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT sport_type, distance, moving_time, start_date, best_efforts
        FROM public.strava_activities_clean
        WHERE user_id = p_user_id
          AND start_date >= ((v_today - 84)::timestamp AT TIME ZONE 'Europe/Warsaw')
        ORDER BY start_date ASC
      ) sub
    ),
    'projects', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, name, status, goal, color, deadline
        FROM public.projects
        WHERE user_id = p_user_id AND status IN ('active', 'paused')
        ORDER BY created_at DESC
      ) sub
    ),
    'moves', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT
          id,
          title,
          CASE
            WHEN status = 'open' THEN 'todo'
            WHEN status = 'done' THEN 'done'
            ELSE status
          END AS status,
          completed_at,
          due_date AS planned_for,
          project_id
        FROM public.todo_items
        WHERE user_id = p_user_id
          AND status <> 'dropped'
          AND COALESCE(is_milestone, false) = false
        ORDER BY updated_at DESC
        LIMIT 80
      ) sub
    ),
    'goals', (
      SELECT row_to_json(sub)::jsonb
      FROM (
        SELECT goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto
        FROM public.life_goals
        WHERE user_id = p_user_id
        LIMIT 1
      ) sub
    ),
    'sprintGoals', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, personal_year, sprint_number, goal_text
        FROM public.sprint_goals
        WHERE user_id = p_user_id
        ORDER BY personal_year ASC, sprint_number ASC
      ) sub
    ),
    'stream', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, source, content, classification, category, tags, importance_score, timestamp
        FROM public.vanguard_stream
        WHERE user_id = p_user_id
          AND (source IS NULL OR source <> 'eval_interview')
          AND COALESCE(importance_score, 0) >= 5
          AND timestamp >= ((v_today - 14)::timestamp AT TIME ZONE 'Europe/Warsaw')
        ORDER BY importance_score DESC, timestamp DESC
        LIMIT 14
      ) sub
    ),
    'patterns', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, title, evidence_text, pattern_type, occurrence_count, confidence, last_seen, status
        FROM public.vanguard_behavioral_patterns
        WHERE user_id = p_user_id AND status = 'active'
        ORDER BY occurrence_count DESC
        LIMIT 10
      ) sub
    ),
    'wins', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, mood_score, daily_rpe, journal_entry, tags
        FROM public.daily_wins
        WHERE user_id = p_user_id AND date >= (v_today - 14)
        ORDER BY date ASC
      ) sub
    ),
    'wiki', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, title, page_type, summary, confidence, updated_at
        FROM public.vanguard_wiki_pages
        WHERE user_id = p_user_id AND status = 'active' AND summary IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 6
      ) sub
    ),
    'knowledge', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, title, content, category, importance_score, tags
        FROM public.vanguard_knowledge
        WHERE user_id = p_user_id AND is_verified = true AND COALESCE(importance_score, 0) >= 7
        ORDER BY importance_score DESC
        LIMIT 6
      ) sub
    ),
    'lenieLogs', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT hl.date, hl.logged_at, hl.final_stimulus, hl.context_note,
          jsonb_build_object('name', h.name, 'is_positive', h.is_positive) AS habits
        FROM public.habit_logs hl
        JOIN public.habits h ON hl.habit_id = h.id
        WHERE hl.user_id = p_user_id
          AND h.is_positive = false
          AND h.name ILIKE '%lenie%'
        ORDER BY hl.date DESC
        LIMIT 10
      ) sub
    ),
    'habits', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT *
        FROM public.habits
        WHERE user_id = p_user_id
        ORDER BY created_at ASC
      ) sub
    ),
    'habitLogs', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT *
        FROM public.habit_logs
        WHERE user_id = p_user_id AND date::date >= (v_today - 30)
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_desktop_dashboard_data(uuid) TO authenticated;
