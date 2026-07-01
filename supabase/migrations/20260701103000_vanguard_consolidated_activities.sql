-- Migration: Create consolidated view for fitness (workout_sessions) and behaviors (behavior_log)
-- Description: Unifies legacy workout tracking with modern behavior logging under a unified query layer

CREATE OR REPLACE VIEW vanguard_consolidated_activities AS
  -- 1. Modern behavior logs (alkohol, podróż, stres, choroba itp.)
  SELECT
    id,
    user_id,
    date::date AS event_date,
    'behavior_log' AS source_type,
    behavior_key AS category,
    behavior_key AS label,
    value AS metric_value,
    note AS details,
    jsonb_build_object(
      'behavior_key', behavior_key,
      'value', value,
      'note', note
    ) AS metadata,
    created_at
  FROM behavior_log

  UNION ALL

  -- 2. Legacy workout sessions (siłownia/bieganie)
  SELECT
    id,
    user_id,
    date::date AS event_date,
    'workout_sessions' AS source_type,
    'workout' AS category,
    workout_day AS label,
    duration_minutes::numeric AS metric_value,
    session_notes AS details,
    jsonb_build_object(
      'workout_day', workout_day,
      'duration_minutes', duration_minutes,
      'session_rpe', session_rpe,
      'hr_avg_bpm', hr_avg_bpm,
      'hr_peak_bpm', hr_peak_bpm,
      'hr_strain_score', hr_strain_score,
      'hr_kcal_est', hr_kcal_est
    ) AS metadata,
    created_at
  FROM workout_sessions;
