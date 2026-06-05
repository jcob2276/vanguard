ALTER TABLE daily_food_entries ADD COLUMN IF NOT EXISTS insulin_load NUMERIC;
ALTER TABLE daily_nutrition ADD COLUMN IF NOT EXISTS insulin_load NUMERIC;
