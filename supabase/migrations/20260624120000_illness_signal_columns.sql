-- Etap 4 (docs/PLAN_READINESS_NOOP.md, sekcja 4.4): Illness Signal Engine
-- z confounder suppression (behavior_log + sauna z exercise_logs).
ALTER TABLE daily_strain
  ADD COLUMN illness_score numeric,
  ADD COLUMN illness_level text;
