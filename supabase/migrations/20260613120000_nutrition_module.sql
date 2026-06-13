-- Nutrition coach module: static human/goal profile + daily computed targets.
--
-- nutrition_profile  — singleton per user: "who you are" + the goal anchor.
-- nutrition_targets  — daily output of vanguard-nutrition-coach: triangulated
--                      maintenance, floating target, protein floor, AI verdict.

-- ─── nutrition_profile ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_profile (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm            numeric,
  birth_date           date,
  sex                  text,                     -- 'M' | 'F'
  goal_body_fat        numeric,                  -- target BF%
  current_body_fat_est numeric,                  -- self-estimate / measured
  goal_target_date     date,                     -- when goal should be hit
  event_name           text,                     -- e.g. 'Maraton Koszyce'
  event_date           date,
  protein_g_per_kg     numeric NOT NULL DEFAULT 2.0,
  weekly_loss_kg       numeric NOT NULL DEFAULT 0.35,
  philosophy_note      text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "np_select" ON nutrition_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "np_insert" ON nutrition_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "np_update" ON nutrition_profile FOR UPDATE USING (auth.uid() = user_id);

-- ─── nutrition_targets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                     text NOT NULL,        -- 'YYYY-MM-DD' Warsaw
  est_maintenance_kcal     int,
  target_kcal              int,
  protein_floor_g          int,
  deficit_kcal             int,
  weight_trend_kg_per_week numeric,
  underlog_gap_kcal        int,
  avg_tdee_oura            int,
  avg_intake_logged        int,
  inputs                   jsonb,
  verdict                  jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nt_select" ON nutrition_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nt_insert" ON nutrition_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nt_update" ON nutrition_targets FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_targets_user_date
  ON nutrition_targets (user_id, date DESC);

-- ─── updated_at trigger (shared helper, idempotent) ───────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_nutrition_profile_updated_at ON nutrition_profile;
CREATE TRIGGER trg_nutrition_profile_updated_at
  BEFORE UPDATE ON nutrition_profile
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_nutrition_targets_updated_at ON nutrition_targets;
CREATE TRIGGER trg_nutrition_targets_updated_at
  BEFORE UPDATE ON nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── Seed Jakub's profile ─────────────────────────────────────────────────────
INSERT INTO nutrition_profile (
  user_id, height_cm, birth_date, sex, goal_body_fat, current_body_fat_est,
  goal_target_date, event_name, event_date, protein_g_per_kg, weekly_loss_kg, philosophy_note
) VALUES (
  '165ae341-670c-46ce-82dc-434c4dbfcdfd', 168, '2002-07-06', 'M', 14, 19,
  '2026-10-04', 'Maraton Koszyce', '2026-10-04', 2.0, 0.35,
  'Redukcja do ~14% BF rownolegle z treningiem maratonskim. Lagodny deficyt (chroni adaptacje biegowa), bialko jako floor, sen 7.5h+. Cel mierzony trendem talia/brzuch/waga, nie samym %BF. Ostatnie 3 tyg przed maratonem = brak deficytu (taper).'
)
ON CONFLICT (user_id) DO NOTHING;
