-- Migration to add Oura bedtime recommendations (sleep_time) to oura_daily_summary table
ALTER TABLE oura_daily_summary 
ADD COLUMN IF NOT EXISTS optimal_bedtime_start_offset INTEGER,
ADD COLUMN IF NOT EXISTS optimal_bedtime_end_offset INTEGER,
ADD COLUMN IF NOT EXISTS sleep_time_recommendation TEXT,
ADD COLUMN IF NOT EXISTS sleep_time_status TEXT;
