-- Migration: V2 daily planning features
-- 1. Add re_entry_mode to daily_plan
-- 2. Create focus_sessions table for enjoyment tracking

ALTER TABLE daily_plan
  ADD COLUMN re_entry_mode boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_subject text NOT NULL,
  duration_seconds integer NOT NULL,
  enjoyment_score smallint CHECK (enjoyment_score BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own focus_sessions"
  ON focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
