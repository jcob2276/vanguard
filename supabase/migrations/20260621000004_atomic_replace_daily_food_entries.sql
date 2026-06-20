-- sync-yazio did DELETE then INSERT for a user/date as two separate round trips.
-- A concurrent invocation (manual sync_history=true racing the cron) could read
-- between the two and persist a zero-calorie day. Move both into one transaction
-- and serialize concurrent callers for the same user+date with an advisory lock,
-- so the empty gap is never observable to another writer.
CREATE OR REPLACE FUNCTION public.replace_daily_food_entries(p_user_id uuid, p_date date, p_entries jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  DELETE FROM public.daily_food_entries
  WHERE user_id = p_user_id AND date = p_date;

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, saturated_fat, salt, insulin_load, meal_type, amount, logged_at
  )
  SELECT
    p_user_id,
    p_date,
    e->>'name',
    e->>'brand',
    (e->>'calories')::integer,
    (e->>'protein')::numeric,
    (e->>'carbs')::numeric,
    (e->>'fat')::numeric,
    (e->>'fiber')::numeric,
    (e->>'sugar')::numeric,
    (e->>'saturated_fat')::numeric,
    (e->>'salt')::numeric,
    (e->>'insulin_load')::numeric,
    e->>'meal_type',
    e->>'amount',
    (e->>'logged_at')::timestamptz
  FROM jsonb_array_elements(p_entries) AS e;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_daily_food_entries(uuid, date, jsonb) TO service_role;
