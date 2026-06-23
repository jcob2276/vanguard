-- Migration: create daily_plan table for interactive day planning
-- This is the "morning input" layer, separate from daily_reconciliations (AI evening output)

CREATE TABLE IF NOT EXISTS daily_plan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date    date NOT NULL,

  -- MIT: Most Important Task
  mit_task_id  uuid REFERENCES todo_items(id) ON DELETE SET NULL,
  mit_custom   text,            -- if user types their own MIT (not linked to a task)

  -- Supporting tasks (stored as JSON array of {id?, title, done} objects)
  supporting   jsonb DEFAULT '[]'::jsonb,

  -- Morning energy check-in (1-5)
  energy_level smallint CHECK (energy_level BETWEEN 1 AND 5),

  -- Midday check-in flag
  midday_checked boolean DEFAULT false,

  -- Evening shutdown
  shutdown_note   text,
  shutdown_at     timestamptz,

  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),

  UNIQUE (user_id, plan_date)
);

ALTER TABLE daily_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily_plan"
  ON daily_plan FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_daily_plan_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_plan_updated_at
  BEFORE UPDATE ON daily_plan
  FOR EACH ROW EXECUTE FUNCTION update_daily_plan_updated_at();
