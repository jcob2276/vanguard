-- Pinned favorites always surface in FoodQuickCapture (daily staples like home coffee).
ALTER TABLE public.food_favorites
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_food_favorites_user_pinned
  ON public.food_favorites (user_id, is_pinned DESC, use_count DESC);

-- Preserve pin when a favorite is touched via add_food_entry quick-add.
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

  INSERT INTO public.food_favorites (
    user_id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, default_grams, is_pinned
  )
  VALUES (
    p_user_id, p_entry->>'barcode', p_entry->>'name', p_entry->>'brand',
    (p_entry->>'calories')::integer, (p_entry->>'protein')::numeric,
    (p_entry->>'carbs')::numeric, (p_entry->>'fat')::numeric,
    (p_entry->>'fiber')::numeric, (p_entry->>'sugar')::numeric,
    p_grams, false
  )
  ON CONFLICT (user_id, name, (COALESCE(brand, ''))) DO UPDATE SET
    use_count = food_favorites.use_count + 1,
    last_used = now(),
    default_grams = p_grams,
    barcode = COALESCE(excluded.barcode, food_favorites.barcode),
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    fiber = excluded.fiber,
    sugar = excluded.sugar,
    is_pinned = food_favorites.is_pinned;

  PERFORM public._recompute_daily_nutrition(p_user_id, p_date);

  RETURN v_id;
END;
$$;
