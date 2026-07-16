-- Add bedtime_end_timestamp to oura_daily_summary
ALTER TABLE public.oura_daily_summary ADD COLUMN IF NOT EXISTS bedtime_end_timestamp timestamp with time zone;

-- Update trigger function to use bedtime_end_timestamp if available
CREATE OR REPLACE FUNCTION public.trg_sync_oura_sleep_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'oura_sleep_' || OLD.user_id || '_' || OLD.date;
    RETURN OLD;
  END IF;

  -- Only sync if bedtime start is present
  IF NEW.bedtime_timestamp IS NULL THEN
    DELETE FROM public.vanguard_calendar
    WHERE event_id = 'oura_sleep_' || NEW.user_id || '_' || NEW.date;
    RETURN NEW;
  END IF;

  v_start := NEW.bedtime_timestamp;
  
  IF NEW.bedtime_end_timestamp IS NOT NULL THEN
    v_end := NEW.bedtime_end_timestamp;
  ELSIF NEW.total_sleep_hours IS NOT NULL THEN
    v_end := NEW.bedtime_timestamp + (NEW.total_sleep_hours * interval '1 hour');
  ELSE
    v_end := NEW.bedtime_timestamp + interval '8 hours'; -- fallback
  END IF;

  INSERT INTO public.vanguard_calendar (user_id, event_id, summary, start_time, end_time, category)
  VALUES (
    NEW.user_id,
    'oura_sleep_' || NEW.user_id || '_' || NEW.date,
    'Sen 🛌',
    v_start,
    v_end,
    'odpoczynek_regeneracja'
  )
  ON CONFLICT (event_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    category = EXCLUDED.category;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security hardening
ALTER FUNCTION public.trg_sync_oura_sleep_to_calendar() SET search_path = '';
