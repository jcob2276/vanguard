-- Add sleep_target_hours to nutrition_profile
-- This allows personalizing the sleep denominator used in recovery_score and fitnessScoreUtils
-- instead of the hardcoded 8.0h. Typical value: 7.5–8.5h based on chronotype/protocol.
ALTER TABLE public.nutrition_profile
  ADD COLUMN IF NOT EXISTS sleep_target_hours numeric DEFAULT 8.0;
