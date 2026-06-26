-- Fix add_food_entry: ON CONFLICT must match expression index on food_favorites
-- (user_id, name, COALESCE(brand, '')) — broken in 20260626120000 used (user_id, name, brand).

CREATE OR REPLACE FUNCTION public.add_food_entry(p_user_id uuid, p_date date, p_grams integer, p_entry jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_scale numeric := p_grams::numeric / 100;
  v_group uuid;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  v_group := NULLIF(p_entry->>'meal_group_id', '')::uuid;

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, meal_type, amount, logged_at, meal_group_id
  ) VALUES (
    p_user_id, p_date,
    p_entry->>'name', p_entry->>'brand',
    ROUND((p_entry->>'calories')::numeric * v_scale)::integer,
    ROUND((p_entry->>'protein')::numeric * v_scale, 1),
    ROUND((p_entry->>'carbs')::numeric * v_scale, 1),
    ROUND((p_entry->>'fat')::numeric * v_scale, 1),
    ROUND((p_entry->>'fiber')::numeric * v_scale, 1),
    ROUND((p_entry->>'sugar')::numeric * v_scale, 1),
    p_entry->>'meal_type', p_grams || ' g', now(), v_group
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
    sugar = excluded.sugar;

  PERFORM public._recompute_daily_nutrition(p_user_id, p_date);

  RETURN v_id;
END;
$$;
