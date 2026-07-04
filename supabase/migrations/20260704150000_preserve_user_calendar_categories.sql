-- Update replace_calendar_window to preserve user-assigned event categories
-- and clean up events that were deleted on Google Calendar.
CREATE OR REPLACE FUNCTION public.replace_calendar_window(
  p_user_id uuid,
  p_category text,
  p_start timestamptz,
  p_end timestamptz,
  p_events jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_category, 0));

  -- 1. Delete events in the window that belong to the sync category (google_sync)
  DELETE FROM public.vanguard_calendar
  WHERE user_id = p_user_id
    AND category = p_category
    AND start_time >= p_start
    AND start_time <= p_end;

  -- 2. Delete events in the window that have a Google event_id but are no longer present in Google Calendar
  DELETE FROM public.vanguard_calendar
  WHERE user_id = p_user_id
    AND start_time >= p_start
    AND start_time <= p_end
    AND event_id IS NOT NULL
    AND event_id NOT IN (
      SELECT e->>'event_id'
      FROM jsonb_array_elements(p_events) AS e
    );

  -- 3. Upsert the current set of events, preserving user-changed categories
  INSERT INTO public.vanguard_calendar (user_id, event_id, summary, start_time, end_time, category)
  SELECT
    p_user_id,
    e->>'event_id',
    e->>'summary',
    (e->>'start_time')::timestamptz,
    (e->>'end_time')::timestamptz,
    p_category
  FROM jsonb_array_elements(p_events) AS e
  ON CONFLICT (event_id) DO UPDATE SET
    summary = excluded.summary,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    category = COALESCE(NULLIF(vanguard_calendar.category, 'google_sync'), excluded.category);
END;
$$;
