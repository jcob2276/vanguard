-- =============================================================
-- Dojo Schema — Practice Dojo separated from Vanguard Core
-- Tables: dojo_curricula, dojo_runs, dojo_reps
-- =============================================================

-- ---- 1. dojo_curricula ----
-- Source of truth for curriculum. Hotfix by UPDATE, no redeploy needed.

CREATE TABLE IF NOT EXISTS dojo_curricula (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  days       jsonb       NOT NULL,
  metadata   jsonb       DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dojo_curricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass dojo_curricula"
  ON dojo_curricula FOR ALL TO service_role
  USING (true);

CREATE POLICY "Authenticated read dojo_curricula"
  ON dojo_curricula FOR SELECT TO authenticated
  USING (true);

-- ---- 2. dojo_runs ----
-- State machine per user per skill sprint.

CREATE TABLE IF NOT EXISTS dojo_runs (
  id                               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                          uuid        NOT NULL,
  skill_name                       text        NOT NULL REFERENCES dojo_curricula(slug),
  current_day                      int         NOT NULL DEFAULT 0,
  phase                            text        NOT NULL DEFAULT 'rep_a'
    CHECK (phase IN ('rep_a', 'correction_rep_a', 'rep_b', 'real_life_transfer', 'completed')),
  attempts_on_day                  int         NOT NULL DEFAULT 0,
  pending_correction_parent_rep_id uuid,
  baseline_stats                   jsonb,
  started_at                       timestamptz DEFAULT now(),
  updated_at                       timestamptz DEFAULT now()
);

ALTER TABLE dojo_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own dojo runs"
  ON dojo_runs FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass dojo_runs"
  ON dojo_runs FOR ALL TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dojo_runs_user_phase
  ON dojo_runs(user_id, phase);

CREATE INDEX IF NOT EXISTS idx_dojo_runs_skill
  ON dojo_runs(skill_name, user_id);

-- ---- 3. dojo_reps ----
-- Individual voice rep records. Evaluation results stored as JSONB.

CREATE TABLE IF NOT EXISTS dojo_reps (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                 uuid        NOT NULL REFERENCES dojo_runs(id) ON DELETE CASCADE,
  user_id                uuid        NOT NULL,
  day                    int         NOT NULL,
  phase                  text        NOT NULL,
  rep_type               text        NOT NULL
    CHECK (rep_type IN ('rep_a', 'correction_rep_a', 'rep_b', 'real_life_transfer')),
  transcript             text,
  audio_duration_seconds float,
  word_count             int,
  evaluation_result      jsonb,
  status                 text
    CHECK (status IN ('pass', 'partial', 'repeat_day', 'self_check', 'diagnostic')),
  parent_rep_id          uuid        REFERENCES dojo_reps(id),
  created_at             timestamptz DEFAULT now()
);

ALTER TABLE dojo_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own dojo reps"
  ON dojo_reps FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass dojo_reps"
  ON dojo_reps FOR ALL TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dojo_reps_run_created
  ON dojo_reps(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dojo_reps_user_day
  ON dojo_reps(user_id, day);
