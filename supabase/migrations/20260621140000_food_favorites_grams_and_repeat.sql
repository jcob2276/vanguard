-- UX fix: favorites previously stored an already-scaled portion snapshot, so a
-- one-tap "quick add" had no per-100g base to rescale from if the user wanted
-- a different amount next time. Switch favorites to store per-100g base values
-- (same shape as lookup-food results) plus the last-used grams, and move the
-- scaling math server-side so the client always sends/receives per-100g data.
ALTER TABLE public.food_favorites ADD COLUMN default_grams integer NOT NULL DEFAULT 100;

-- Changing the parameter list, not just the body — drop the old 3-arg overload
-- first so CREATE OR REPLACE doesn't leave it dangling as a stale duplicate.
DROP FUNCTION IF EXISTS public.add_food_entry(uuid, date, jsonb);

CREATE OR REPLACE FUNCTION public.add_food_entry(p_user_id uuid, p_date date, p_grams integer, p_entry jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_scale numeric := p_grams::numeric / 100;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, meal_type, amount, logged_at
  ) VALUES (
    p_user_id, p_date,
    p_entry->>'name', p_entry->>'brand',
    ROUND((p_entry->>'calories')::numeric * v_scale)::integer,
    ROUND((p_entry->>'protein')::numeric * v_scale, 1),
    ROUND((p_entry->>'carbs')::numeric * v_scale, 1),
    ROUND((p_entry->>'fat')::numeric * v_scale, 1),
    ROUND((p_entry->>'fiber')::numeric * v_scale, 1),
    ROUND((p_entry->>'sugar')::numeric * v_scale, 1),
    p_entry->>'meal_type', p_grams || ' g', now()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.food_favorites (user_id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, default_grams)
  VALUES (
    p_user_id, p_entry->>'barcode', p_entry->>'name', p_entry->>'brand',
    (p_entry->>'calories')::integer, (p_entry->>'protein')::numeric,
    (p_entry->>'carbs')::numeric, (p_entry->>'fat')::numeric,
    (p_entry->>'fiber')::numeric, (p_entry->>'sugar')::numeric,
    p_grams
  )
  ON CONFLICT (user_id, name, brand) DO UPDATE SET
    use_count = food_favorites.use_count + 1,
    last_used = now(),
    default_grams = p_grams,
    barcode = COALESCE(excluded.barcode, food_favorites.barcode),
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    fiber = excluded.fiber,
    sugar = excluded.sugar;

  PERFORM public._recompute_daily_nutrition(p_user_id, p_date);

  RETURN v_id;
END;
$$;

-- One-tap "log this again" for the Ostatnie (recent) tab — duplicates an existing
-- entry as-is into today rather than re-deriving it from a per-100g base.
CREATE OR REPLACE FUNCTION public.repeat_food_entry(p_user_id uuid, p_source_entry_id uuid, p_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, saturated_fat, salt, insulin_load, meal_type, amount, logged_at
  )
  SELECT
    p_user_id, p_date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, saturated_fat, salt, insulin_load, meal_type, amount, now()
  FROM public.daily_food_entries
  WHERE id = p_source_entry_id AND user_id = p_user_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  PERFORM public._recompute_daily_nutrition(p_user_id, p_date);

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_food_entry FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_food_entry TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repeat_food_entry FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repeat_food_entry TO authenticated;
