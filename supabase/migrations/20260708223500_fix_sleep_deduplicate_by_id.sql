-- Fix sleep deduplication trigger to look at event_id patterns instead of category names, and clean up existing duplicates.

-- 1. Clean up any existing duplicate local Oura sleep events that overlap with non-Oura sleep events
DELETE FROM public.vanguard_calendar o
WHERE o.event_id LIKE 'oura_sleep_%'
  AND EXISTS (
    SELECT 1 FROM public.vanguard_calendar g
    WHERE g.user_id = o.user_id
      AND g.event_id NOT LIKE 'oura_sleep_%'
      AND (g.summary ILIKE 'sen%' OR g.summary ILIKE 'sleep%')
      AND g.start_time >= o.start_time - interval '4 hours'
      AND g.start_time <= o.start_time + interval '4 hours'
  );

-- 2. Trigger function to prevent duplicate sleep events using event_id patterns
CREATE OR REPLACE FUNCTION public.trg_deduplicate_calendar_sleep()
RETURNS TRIGGER AS $$
BEGIN
  -- If a non-Oura sleep event is inserted/updated, delete any overlapping local Oura sleep event
  IF NEW.event_id NOT LIKE 'oura_sleep_%' AND (NEW.summary ILIKE 'sen%' OR NEW.summary ILIKE 'sleep%') THEN
    DELETE FROM public.vanguard_calendar
    WHERE user_id = NEW.user_id
      AND event_id LIKE 'oura_sleep_%'
      AND start_time >= NEW.start_time - interval '4 hours'
      AND start_time <= NEW.start_time + interval '4 hours';
  END IF;

  -- If a local Oura sleep event is inserted/updated, skip it if an overlapping non-Oura sleep event exists
  IF NEW.event_id LIKE 'oura_sleep_%' THEN
    IF EXISTS (
      SELECT 1 FROM public.vanguard_calendar
      WHERE user_id = NEW.user_id
        AND event_id NOT LIKE 'oura_sleep_%'
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

-- Re-create the trigger
DROP TRIGGER IF EXISTS deduplicate_calendar_sleep_trigger ON public.vanguard_calendar;
CREATE TRIGGER deduplicate_calendar_sleep_trigger
BEFORE INSERT OR UPDATE ON public.vanguard_calendar
FOR EACH ROW EXECUTE FUNCTION public.trg_deduplicate_calendar_sleep();
