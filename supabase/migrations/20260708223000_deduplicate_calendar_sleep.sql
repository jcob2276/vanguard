-- Deduplicate calendar sleep events: prefer Google Calendar sync sleep events over local Oura sleep events.

-- 1. Clean up any existing duplicate local Oura sleep events that overlap with Google Calendar sleep events
DELETE FROM public.vanguard_calendar o
USING public.vanguard_calendar g
WHERE o.event_id LIKE 'oura_sleep_%'
  AND g.category = 'google_sync'
  AND (g.summary ILIKE 'sen%' OR g.summary ILIKE 'sleep%')
  AND o.user_id = g.user_id
  AND o.start_time >= g.start_time - interval '4 hours'
  AND o.start_time <= g.start_time + interval '4 hours';

-- 2. Trigger function to prevent duplicate sleep events going forward
CREATE OR REPLACE FUNCTION public.trg_deduplicate_calendar_sleep()
RETURNS TRIGGER AS $$
BEGIN
  -- If a Google Calendar sleep event is inserted/updated, delete any overlapping local Oura sleep event
  IF NEW.category = 'google_sync' AND (NEW.summary ILIKE 'sen%' OR NEW.summary ILIKE 'sleep%') THEN
    DELETE FROM public.vanguard_calendar
    WHERE user_id = NEW.user_id
      AND event_id LIKE 'oura_sleep_%'
      AND start_time >= NEW.start_time - interval '4 hours'
      AND start_time <= NEW.start_time + interval '4 hours';
  END IF;

  -- If a local Oura sleep event is inserted/updated, skip it if an overlapping Google Calendar sleep event exists
  IF NEW.event_id LIKE 'oura_sleep_%' THEN
    IF EXISTS (
      SELECT 1 FROM public.vanguard_calendar
      WHERE user_id = NEW.user_id
        AND category = 'google_sync'
        AND (summary ILIKE 'sen%' OR summary ILIKE 'sleep%')
        AND start_time >= NEW.start_time - interval '4 hours'
        AND start_time <= NEW.start_time + interval '4 hours'
    ) THEN
      RETURN NULL; -- Aborts the insert/update
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger BEFORE insert or update on vanguard_calendar
CREATE OR REPLACE TRIGGER deduplicate_calendar_sleep_trigger
BEFORE INSERT OR UPDATE ON public.vanguard_calendar
FOR EACH ROW EXECUTE FUNCTION public.trg_deduplicate_calendar_sleep();
