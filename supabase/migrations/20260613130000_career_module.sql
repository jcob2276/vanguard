-- Career module (MVP) — app-first, additive. Does NOT touch daily_wins / PowerList /
-- Direction / Telegram / life_goals. Four tables:
--   career_projects   — carrier of meaning / thesis / energy investment (NOT a task list)
--   career_moves      — single operational move in the career
--   career_evidence   — what actually happened (lightweight timeline)
--   career_decisions  — first-class decisions that change energy allocation
--
-- Store only what the user enters. Momentum / last meaningful output / next move
-- are derived in the frontend, not stored. No AI classification, no Telegram in MVP.

-- ─── career_projects ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  thesis          text,
  why             text,
  area            text NOT NULL DEFAULT 'career',
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','archived')),
  sense_status    text NOT NULL DEFAULT 'worth_it'
                    CHECK (sense_status IN ('worth_it','questionable','paused','cut','completed')),
  leverage_level  int CHECK (leverage_level BETWEEN 1 AND 3),
  cost_level      text CHECK (cost_level IN ('low','medium','high')),
  risk_level      text CHECK (risk_level IN ('low','medium','high')),
  review_cadence  text CHECK (review_cadence IN ('weekly','biweekly','monthly','ad_hoc')),
  last_reviewed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── career_moves ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_moves (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES career_projects(id) ON DELETE SET NULL,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo','doing','done','blocked','dropped')),
  area         text NOT NULL DEFAULT 'career',
  value_type   text CHECK (value_type IN ('leverage','stability','recovery')),
  work_mode    text CHECK (work_mode IN ('deep','shallow','admin','recovery','physical','social')),
  source       text NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual','suggestion','recurring','imported')),
  planned_for  date,
  completed_at timestamptz,
  energy_cost  text CHECK (energy_cost IN ('low','medium','high')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── career_evidence ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_evidence (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES career_projects(id) ON DELETE SET NULL,
  move_id      uuid REFERENCES career_moves(id) ON DELETE SET NULL,
  type         text NOT NULL
                 CHECK (type IN ('commit','deploy','note','metric','file','photo','health_data','conversation','test','manual')),
  title        text NOT NULL,
  description  text,
  external_ref text,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── career_decisions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES career_projects(id) ON DELETE SET NULL,
  title           text NOT NULL,
  decision        text,
  context         text,
  area            text NOT NULL DEFAULT 'career',
  decision_type   text CHECK (decision_type IN ('start','stop','continue','pause','pivot','commit','cut_scope','invest','avoid')),
  expected_effect text,
  tradeoff        text,
  fear_or_risk    text,
  decided_at      timestamptz NOT NULL DEFAULT now(),
  review_date     date,
  result_summary  text,
  verdict         text CHECK (verdict IN ('good','bad','mixed','too_early')),
  evidence_id     uuid REFERENCES career_evidence(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS (every table; per-operation policies, idempotent) ─────────────────────
ALTER TABLE career_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_moves     ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_evidence  ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_select" ON career_projects;
DROP POLICY IF EXISTS "cp_insert" ON career_projects;
DROP POLICY IF EXISTS "cp_update" ON career_projects;
CREATE POLICY "cp_select" ON career_projects FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "cp_insert" ON career_projects FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "cp_update" ON career_projects FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cm_select" ON career_moves;
DROP POLICY IF EXISTS "cm_insert" ON career_moves;
DROP POLICY IF EXISTS "cm_update" ON career_moves;
CREATE POLICY "cm_select" ON career_moves FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "cm_insert" ON career_moves FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "cm_update" ON career_moves FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ce_select" ON career_evidence;
DROP POLICY IF EXISTS "ce_insert" ON career_evidence;
DROP POLICY IF EXISTS "ce_update" ON career_evidence;
CREATE POLICY "ce_select" ON career_evidence FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "ce_insert" ON career_evidence FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "ce_update" ON career_evidence FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cd_select" ON career_decisions;
DROP POLICY IF EXISTS "cd_insert" ON career_decisions;
DROP POLICY IF EXISTS "cd_update" ON career_decisions;
CREATE POLICY "cd_select" ON career_decisions FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "cd_insert" ON career_decisions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "cd_update" ON career_decisions FOR UPDATE USING ((select auth.uid()) = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_career_projects_user_status   ON career_projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_career_moves_user_status      ON career_moves (user_id, status);
CREATE INDEX IF NOT EXISTS idx_career_moves_project          ON career_moves (project_id);
CREATE INDEX IF NOT EXISTS idx_career_evidence_user_time     ON career_evidence (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_evidence_project       ON career_evidence (project_id);
CREATE INDEX IF NOT EXISTS idx_career_decisions_user_time    ON career_decisions (user_id, decided_at DESC);

-- ─── updated_at trigger (shared helper, idempotent) ───────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_career_projects_updated_at ON career_projects;
CREATE TRIGGER trg_career_projects_updated_at
  BEFORE UPDATE ON career_projects
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_career_moves_updated_at ON career_moves;
CREATE TRIGGER trg_career_moves_updated_at
  BEFORE UPDATE ON career_moves
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_career_evidence_updated_at ON career_evidence;
CREATE TRIGGER trg_career_evidence_updated_at
  BEFORE UPDATE ON career_evidence
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_career_decisions_updated_at ON career_decisions;
CREATE TRIGGER trg_career_decisions_updated_at
  BEFORE UPDATE ON career_decisions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── Expose to authenticated (RLS still limits rows to auth.uid()) ─────────────
GRANT SELECT, INSERT, UPDATE ON career_projects  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON career_moves     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON career_evidence  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON career_decisions TO authenticated;
