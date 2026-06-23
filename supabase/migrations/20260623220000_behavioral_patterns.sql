-- Etap 1: Behavioral Pattern Detection Engine
-- vanguard_behavioral_patterns: stores detected behavioral patterns
-- vanguard_pattern_feedback: user feedback on patterns
-- vanguard_iron_rules: static context rules for Oracle

-- ============================================================
-- 1. vanguard_behavioral_patterns
-- ============================================================
CREATE TABLE IF NOT EXISTS vanguard_behavioral_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  signature text NOT NULL,
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  first_seen date,
  last_seen date,
  occurrence_count int DEFAULT 0,
  avg_impact numeric,
  confidence numeric,
  status text DEFAULT 'hypothesis',
  user_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vanguard_behavioral_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON vanguard_behavioral_patterns
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_vbp_user_status
  ON vanguard_behavioral_patterns (user_id, status);

CREATE INDEX IF NOT EXISTS idx_vbp_user_type
  ON vanguard_behavioral_patterns (user_id, pattern_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vbp_user_signature
  ON vanguard_behavioral_patterns (user_id, signature);

-- ============================================================
-- 2. vanguard_pattern_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS vanguard_pattern_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id uuid REFERENCES vanguard_behavioral_patterns(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (feedback IN ('confirmed', 'rejected', 'observe')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vanguard_pattern_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON vanguard_pattern_feedback
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. vanguard_iron_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS vanguard_iron_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_text text NOT NULL,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vanguard_iron_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON vanguard_iron_rules
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS idx_vir_user_key
  ON vanguard_iron_rules (user_id, rule_key);
