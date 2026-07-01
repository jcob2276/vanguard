-- Add new metrics for BackTo20/20 compliance
ALTER TABLE public.endmyopia_daily_logs 
ADD COLUMN outdoor_minutes INTEGER DEFAULT 0,
ADD COLUMN breaks_taken INTEGER DEFAULT 0,
ADD COLUMN snellen_left TEXT,
ADD COLUMN snellen_right TEXT,
ADD COLUMN snellen_both TEXT,
ADD COLUMN distance_object_notes TEXT;
