-- sync-calendar did DELETE (by window) then UPSERT (by event_id) as two separate round
-- trips. Two overlapping sync calls (e.g. user double-clicking "sync") could race: the
-- second call's DELETE/INSERT could land between the first's DELETE and INSERT, leaving
-- the calendar empty or overwritten depending on completion order. Same fix pattern as
-- replace_daily_food_entries (20260621000004): one transaction, serialized per user+category.
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

  DELETE FROM public.vanguard_calendar
  WHERE user_id = p_user_id
    AND category = p_category
    AND start_time >= p_start
    AND start_time <= p_end;

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
    category = excluded.category;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_calendar_window(uuid, text, timestamptz, timestamptz, jsonb) TO service_role;
