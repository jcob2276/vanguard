import type { DeepSeekTool } from "../../_shared/deepseek.ts";

const SQL_TOOL_SCHEMA_HINT = `
To jednoużytkownikowa baza (wszystkie wiersze należą do Jakuba) — nie musisz filtrować po user_id.
Klucz główny każdej tabeli to "id" (uuid), chyba że zaznaczono inaczej. "→" pokazuje po czym łączyć (JOIN).

DIETA:
- daily_nutrition(date, calories, protein, carbs, fat, fiber, sugar, avg_food_quality) — dzienne podsumowanie
- daily_food_entries(date, name, calories, protein, carbs, fat, meal_type, logged_at, food_quality_score) — pojedyncze posiłki
- food_library(name, brand, calories, protein, carbs, fat) — katalog produktów (referencja, nie log spożycia)
- nutrition_targets(date, target_kcal, protein_floor_g, deficit_kcal, est_maintenance_kcal)
- nutrition_profile(goal_body_fat, current_body_fat_est, event_date, event_name, protein_g_per_kg) — 1 wiersz, PK=user_id
- fasting_logs(date, note)

TRENING:
- workout_sessions(date, workout_day, duration_minutes, session_notes, session_rpe, hr_avg_bpm, hr_kcal_est, msp_passed)
- exercise_logs(session_id → workout_sessions.id, exercise_name, set_number, reps, weight, rpe, rir, muscle_tags)
- strava_activities(name, sport_type, start_date, distance, moving_time, average_heartrate, calories, suffer_score, gc_vo2max, trimp) — PK=strava_id

SEN / BIOMETRIA:
- oura_daily_summary(date, readiness_score, total_sleep_hours, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, sleep_score, steps, stress_score)
- daily_strain(date, strain_score, recovery_score, daily_status, main_limiter, illness_score, illness_level, cardio_load, strength_load, leg_load, cns_load)
- body_metrics(date, weight, waist, body_fat, chest, thigh, calf, muscle_mass)
- body_composition_measurements(measured_at, weight_kg, body_fat_pct, muscle_mass_kg, bmr_kcal, visceral_fat_rating) — precyzyjniejszy pomiar (skala)

ZADANIA / PRODUKTYWNOŚĆ:
- projects(name, goal, status, deadline, dream_id, goal_id)
- todo_sections(name, project_id → projects.id)
- todo_items(project_id → projects.id, section_id → todo_sections.id, title, notes, status, priority, due_date, completed_at, category)
- daily_wins(date, week_start, task_1..task_5, done_1..done_5, mood_score, daily_rpe, journal_entry)
- habits(name, is_positive), habit_logs(habit_id → habits.id, date, completed, context_note)
- weekly_reviews(week_start, proud_of, sabotage, do_differently, week_sentiment, bottleneck, pillar_scores)
- monthly_reviews(month_start, pattern_note, leverage_note, month_theme)
- daily_reconciliations(date, status, day_score, plan_quality, plan_failure_reason) — wieczorna refleksja/rekoncyliacja dnia
- life_goals(goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto) — 1 wiersz, cele życiowe (3 filary)
- goal_kpis(pillar, name, unit, target, project_id → projects.id), kpi_entries(kpi_id → goal_kpis.id, week_start, value)
- sprint_goals(sprint_number, goal_text, focus_project_ids)
- learning_skills(key, label), learning_week_focus(skill_id → learning_skills.id, week_start, rep_target, rep_done)

ZDROWIE:
- medical_lab_results(result_date, marker_key, marker_name, category, value, unit, ref_low, ref_high, flag) — wyniki badań krwi itp.
- medical_documents(document_date, document_type, summary)
- supplements(name, active), supplement_logs(supplement_id → supplements.id, date, quantity)
- endmyopia_measurements(measured_at, eye_measured, blur_distance_cm, diopters), endmyopia_prescriptions(type, sphere_l, sphere_r, started_at)

NAWYKI CYFROWE / KONTEKST:
- phone_usage_daily(date, total_minutes, late_night_minutes, social_minutes, unlocks)
- vanguard_calendar(summary, start_time, end_time, category)
- location_history(created_at, latitude, longitude, place_name)
- vanguard_stream(source, content, category, timestamp) — surowy log rozmów/notatek, dobre do wyszukiwania kontekstu
- vanguard_notes(title, content, tags, is_pinned)
- friction_events(occurred_at, friction_type, declared_intention, actual_behavior, deviation) — rozjazd deklaracja vs zachowanie
`.trim();

export function buildSqlTool(): DeepSeekTool {
  return {
    type: "function",
    function: {
      name: "query_database",
      description: `Wykonuje zapytanie SQL SELECT tylko do odczytu na bazie Vanguard, żeby odpowiedzieć na pytania o dietę, trening, sen, nastrój, zadania itd. Zwraca maks. 200 wierszy. Zawsze jedno zapytanie SELECT/WITH, bez średników.\n\n${SQL_TOOL_SCHEMA_HINT}`,
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Pojedyncze zapytanie SELECT/WITH w Postgres SQL." },
        },
        required: ["sql"],
      },
    },
  };
}
