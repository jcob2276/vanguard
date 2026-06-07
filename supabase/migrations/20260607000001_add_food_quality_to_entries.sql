-- Food quality scoring columns
-- food_quality_score: 0-100 per item (intrinsic quality, scored by AI dietitian)
-- quality_reason: one-sentence explanation
ALTER TABLE daily_food_entries
  ADD COLUMN IF NOT EXISTS food_quality_score INTEGER,
  ADD COLUMN IF NOT EXISTS quality_reason TEXT;

-- Day-level quality summary on daily_nutrition
-- avg_food_quality: calorie-weighted average of item scores for the day
-- food_quality_analysis: contextual 2-4 sentence analysis vs 30-day pattern
ALTER TABLE daily_nutrition
  ADD COLUMN IF NOT EXISTS avg_food_quality INTEGER,
  ADD COLUMN IF NOT EXISTS food_quality_analysis TEXT;
