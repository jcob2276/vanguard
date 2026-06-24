-- 1. Dodaj kolumnę neck do body_metrics
ALTER TABLE body_metrics ADD COLUMN IF NOT EXISTS neck numeric;

-- 2. Funkcja Navy Method BF%
-- Mężczyźni: BF% = 495 / (1.0324 - 0.19077*log10(waist-neck) + 0.15456*log10(height)) - 450
-- Kobiety:   BF% = 495 / (1.29579 - 0.35004*log10(waist+hips-neck) + 0.22100*log10(height)) - 450
CREATE OR REPLACE FUNCTION compute_navy_bf()
RETURNS TRIGGER AS $$
DECLARE
  v_height numeric;
  v_sex    text;
  v_bf     numeric;
  v_diff   numeric;
BEGIN
  IF NEW.neck IS NULL OR NEW.waist IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT height_cm, UPPER(COALESCE(sex, 'M'))
  INTO v_height, v_sex
  FROM nutrition_profile
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_height IS NULL OR v_height <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_sex = 'F' AND NEW.hips IS NOT NULL THEN
    v_diff := NEW.waist + NEW.hips - NEW.neck;
    IF v_diff <= 0 THEN RETURN NEW; END IF;
    v_bf := 495.0 / (1.29579 - 0.35004 * LOG(v_diff) + 0.22100 * LOG(v_height)) - 450.0;
  ELSE
    v_diff := NEW.waist - NEW.neck;
    IF v_diff <= 0 THEN RETURN NEW; END IF;
    v_bf := 495.0 / (1.0324 - 0.19077 * LOG(v_diff) + 0.15456 * LOG(v_height)) - 450.0;
  END IF;

  v_bf := GREATEST(3.0, LEAST(50.0, ROUND(v_bf::numeric, 1)));
  NEW.body_fat := v_bf;

  UPDATE nutrition_profile
  SET current_body_fat_est = v_bf,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_navy_bf ON body_metrics;
CREATE TRIGGER trg_navy_bf
  BEFORE INSERT OR UPDATE OF neck, waist, hips
  ON body_metrics
  FOR EACH ROW
  EXECUTE FUNCTION compute_navy_bf();
