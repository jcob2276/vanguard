-- Anti-goals per pillar: "czego świadomie NIE robię, żeby cel się spełnił".
-- Same write pattern as goal_* columns (rare, manual/agent edit — no in-app form);
-- consumer: goal tree in the Projekty tab.
ALTER TABLE public.life_goals
  ADD COLUMN IF NOT EXISTS anti_goal_cialo text,
  ADD COLUMN IF NOT EXISTS anti_goal_duch text,
  ADD COLUMN IF NOT EXISTS anti_goal_konto text;
