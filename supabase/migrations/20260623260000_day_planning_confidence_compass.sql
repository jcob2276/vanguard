-- Migration: confidence gate + "the Compass" (avoided task) on daily_plan
ALTER TABLE daily_plan
  ADD COLUMN mit_confidence smallint CHECK (mit_confidence BETWEEN 1 AND 10),
  ADD COLUMN avoided_task text;
