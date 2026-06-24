-- Supplement catalog + logs for manual tracking via Telegram
CREATE TABLE supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '💊',
  unit text NOT NULL DEFAULT 'kapsułka',
  dose_per_unit jsonb NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  date text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_supplements" ON supplements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_supplement_logs" ON supplement_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX supplement_logs_user_date ON supplement_logs (user_id, date);

-- Seed Jakub's stack
DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT user_id INTO uid FROM user_settings LIMIT 1;
  IF uid IS NULL THEN RETURN; END IF;

  INSERT INTO supplements (user_id, slug, name, emoji, unit, dose_per_unit, sort_order) VALUES
    (uid, 'd3k2',      'D3 + K2 MK-7', '☀️', 'naciśnięcie', '{"d3_iu": 2000, "k2_mcg": 25}',              1),
    (uid, 'omega3',    'Omega-3',       '🐟', 'kapsułka',    '{"total_mg": 1000, "epa_mg": 500, "dha_mg": 250}', 2),
    (uid, 'lionsmane', 'Lion''s Mane',  '🍄', 'kapsułka',    '{"extract_mg": 400}',                         3),
    (uid, 'cynk',      'Cynk',          '💊', 'kapsułka',    '{"zn_mg": 15}',                               4),
    (uid, 'kreatyna',  'Kreatyna',      '⚡', 'porcja',      '{"creatine_g": 5}',                           5)
  ON CONFLICT (user_id, slug) DO NOTHING;
END $$;
