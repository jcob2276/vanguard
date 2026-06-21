-- Own food-logging module (replacement path for Yazio sync, running in parallel).
-- food_favorites caches the user's frequently-logged products so re-logging is
-- a single tap instead of a search/scan round trip.
CREATE TABLE public.food_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  barcode text,
  name text NOT NULL,
  brand text,
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugar numeric,
  last_used timestamptz NOT NULL DEFAULT now(),
  use_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, brand)
);

ALTER TABLE public.food_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.food_favorites FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_food_favorites_user_last_used ON public.food_favorites (user_id, last_used DESC);

-- Re-aggregates daily_nutrition from the current daily_food_entries rows for one
-- user+date. Called after every add/update/remove so the two tables never drift.
CREATE OR REPLACE FUNCTION public._recompute_daily_nutrition(p_user_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_nutrition (user_id, date, calories, protein, carbs, fat, fiber, sugar, insulin_load)
  SELECT
    p_user_id,
    p_date,
    SUM(calories),
    SUM(protein),
    SUM(carbs),
    SUM(fat),
    SUM(fiber),
    SUM(sugar),
    SUM(insulin_load)
  FROM public.daily_food_entries
  WHERE user_id = p_user_id AND date = p_date
  ON CONFLICT (user_id, date) DO UPDATE SET
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    fiber = excluded.fiber,
    sugar = excluded.sugar,
    insulin_load = excluded.insulin_load;
END;
$$;

-- Adds one manually-logged meal entry, upserts it into favorites, and re-aggregates
-- the day's total. Locks on the same (user_id, date) key as replace_daily_food_entries
-- so this can never race a concurrent Yazio sync for the same day.
CREATE OR REPLACE FUNCTION public.add_food_entry(p_user_id uuid, p_date date, p_entry jsonb)
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
    fiber, sugar, meal_type, amount, logged_at
  ) VALUES (
    p_user_id, p_date,
    p_entry->>'name', p_entry->>'brand',
    (p_entry->>'calories')::integer, (p_entry->>'protein')::numeric,
    (p_entry->>'carbs')::numeric, (p_entry->>'fat')::numeric,
    (p_entry->>'fiber')::numeric, (p_entry->>'sugar')::numeric,
    p_entry->>'meal_type', p_entry->>'amount', now()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.food_favorites (user_id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar)
  VALUES (
    p_user_id, p_entry->>'barcode', p_entry->>'name', p_entry->>'brand',
    (p_entry->>'calories')::integer, (p_entry->>'protein')::numeric,
    (p_entry->>'carbs')::numeric, (p_entry->>'fat')::numeric,
    (p_entry->>'fiber')::numeric, (p_entry->>'sugar')::numeric
  )
  ON CONFLICT (user_id, name, brand) DO UPDATE SET
    use_count = food_favorites.use_count + 1,
    last_used = now(),
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

-- Edits one entry in place (e.g. corrected quantity) and re-aggregates. Looks up the
-- entry's own date rather than trusting the caller, so the lock always matches the
-- row actually being touched even if the client sends a stale date.
CREATE OR REPLACE FUNCTION public.update_food_entry(p_user_id uuid, p_entry_id uuid, p_entry jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT date INTO v_date FROM public.daily_food_entries WHERE id = p_entry_id AND user_id = p_user_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_date::text, 0));

  UPDATE public.daily_food_entries SET
    name = COALESCE(p_entry->>'name', name),
    brand = COALESCE(p_entry->>'brand', brand),
    calories = COALESCE((p_entry->>'calories')::integer, calories),
    protein = COALESCE((p_entry->>'protein')::numeric, protein),
    carbs = COALESCE((p_entry->>'carbs')::numeric, carbs),
    fat = COALESCE((p_entry->>'fat')::numeric, fat),
    fiber = COALESCE((p_entry->>'fiber')::numeric, fiber),
    sugar = COALESCE((p_entry->>'sugar')::numeric, sugar),
    meal_type = COALESCE(p_entry->>'meal_type', meal_type),
    amount = COALESCE(p_entry->>'amount', amount)
  WHERE id = p_entry_id AND user_id = p_user_id;

  PERFORM public._recompute_daily_nutrition(p_user_id, v_date);
END;
$$;

-- Deletes one entry and re-aggregates the day. Same ownership + lock pattern as update.
CREATE OR REPLACE FUNCTION public.remove_food_entry(p_user_id uuid, p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT date INTO v_date FROM public.daily_food_entries WHERE id = p_entry_id AND user_id = p_user_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_date::text, 0));

  DELETE FROM public.daily_food_entries WHERE id = p_entry_id AND user_id = p_user_id;

  PERFORM public._recompute_daily_nutrition(p_user_id, v_date);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_food_entry FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_food_entry FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_food_entry FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_food_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_food_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_food_entry TO authenticated;
