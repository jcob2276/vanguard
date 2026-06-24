-- Etap 1 (PLAN_READINESS_NOOP.md): behavior_log dla confounderów, których nigdzie
-- jeszcze nie logujemy (alkohol, podróż, stres, choroba). Sauna NIE wchodzi tu —
-- już jest w exercise_logs (exercise_name ILIKE 'sauna%'), patrz plan sekcja 3.
CREATE TABLE behavior_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  behavior_key text NOT NULL,
  value numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, behavior_key)
);

ALTER TABLE behavior_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_behavior_log" ON behavior_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX behavior_log_user_date ON behavior_log (user_id, date);
CREATE INDEX behavior_log_user_key ON behavior_log (user_id, behavior_key);

-- Etap 3 (4.17 ManualWorkoutRescore pattern): per-sesja strain z parowania
-- workout_sessions.start_time/end_time z oura_heartrate, niezależne od dziennego
-- daily_strain.strain_score (mix cardio+strength+steps+fueling).
ALTER TABLE workout_sessions
  ADD COLUMN hr_avg_bpm numeric,
  ADD COLUMN hr_peak_bpm numeric,
  ADD COLUMN hr_strain_score numeric,
  ADD COLUMN hr_kcal_est numeric,
  ADD COLUMN hr_rescored_at timestamptz;
