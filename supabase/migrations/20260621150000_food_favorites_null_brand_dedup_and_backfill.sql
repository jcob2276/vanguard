-- UNIQUE(user_id, name, brand) never dedups when brand IS NULL — Postgres treats
-- every NULL as distinct from every other NULL, so two add_food_entry calls for the
-- same unbranded generic food (e.g. "Ziemniaki gotowane") would insert two favorites
-- rows instead of incrementing use_count on one. Replace with an expression index
-- that normalizes NULL to '' for uniqueness purposes.
ALTER TABLE public.food_favorites DROP CONSTRAINT IF EXISTS food_favorites_user_id_name_brand_key;
CREATE UNIQUE INDEX IF NOT EXISTS food_favorites_user_name_brand_key
  ON public.food_favorites (user_id, name, COALESCE(brand, ''));

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

-- One-time backfill: surface the user's real Yazio-synced eating history in the
-- "Częste" tab instead of starting empty. Yazio's `amount` string always leads with
-- a number that's gram/ml-equivalent for whatever calories/macros are stored
-- alongside it (e.g. "150 g/porcja", "250 ml", "330 but.", "90 package"), so that
-- leading number is the scale factor back to per-100g regardless of the unit word.
WITH parsed AS (
  SELECT
    user_id, name, brand, calories, protein, carbs, fat, fiber, sugar, logged_at,
    (regexp_match(amount, '^(\d+(\.\d+)?)'))[1]::numeric AS grams,
    row_number() OVER (PARTITION BY user_id, name, COALESCE(brand, '') ORDER BY logged_at DESC NULLS LAST) AS rn
  FROM public.daily_food_entries
  WHERE amount ~ '^\d' AND calories IS NOT NULL
),
latest AS (
  SELECT * FROM parsed WHERE rn = 1 AND grams > 0
),
counts AS (
  SELECT user_id, name, brand, count(*) AS use_count, max(logged_at) AS last_used
  FROM public.daily_food_entries
  WHERE amount ~ '^\d'
  GROUP BY user_id, name, brand
)
INSERT INTO public.food_favorites (user_id, name, brand, calories, protein, carbs, fat, fiber, sugar, default_grams, use_count, last_used)
SELECT
  l.user_id, l.name, l.brand,
  ROUND(l.calories * 100 / l.grams)::integer,
  ROUND(l.protein * 100 / l.grams, 2),
  ROUND(l.carbs * 100 / l.grams, 2),
  ROUND(l.fat * 100 / l.grams, 2),
  ROUND(l.fiber * 100 / l.grams, 2),
  ROUND(l.sugar * 100 / l.grams, 2),
  ROUND(l.grams)::integer,
  c.use_count,
  COALESCE(c.last_used, now())
FROM latest l
JOIN counts c ON c.user_id = l.user_id AND c.name = l.name AND COALESCE(c.brand, '') = COALESCE(l.brand, '')
ON CONFLICT (user_id, name, (COALESCE(brand, ''))) DO UPDATE SET
  calories = excluded.calories,
  protein = excluded.protein,
  carbs = excluded.carbs,
  fat = excluded.fat,
  fiber = excluded.fiber,
  sugar = excluded.sugar,
  default_grams = excluded.default_grams,
  use_count = excluded.use_count,
  last_used = excluded.last_used;
