-- food_corrections: user portion/name fixes feed back into NL parser few-shot
CREATE TABLE IF NOT EXISTS public.food_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_name text NOT NULL,
  corrected_name text,
  corrected_grams integer NOT NULL,
  use_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, query_name)
);

ALTER TABLE public.food_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.food_corrections FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_food_corrections_user ON public.food_corrections (user_id, updated_at DESC);

-- Bundled NL meals share one group id in UI
ALTER TABLE public.daily_food_entries ADD COLUMN IF NOT EXISTS meal_group_id uuid;

CREATE OR REPLACE FUNCTION public.save_food_correction(
  p_user_id uuid,
  p_query_name text,
  p_corrected_grams integer,
  p_corrected_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_query_name IS NULL OR trim(p_query_name) = '' OR p_corrected_grams IS NULL OR p_corrected_grams < 1 THEN
    RAISE EXCEPTION 'invalid correction';
  END IF;

  INSERT INTO public.food_corrections (user_id, query_name, corrected_name, corrected_grams)
  VALUES (p_user_id, lower(trim(p_query_name)), NULLIF(trim(p_corrected_name), ''), p_corrected_grams)
  ON CONFLICT (user_id, query_name) DO UPDATE SET
    corrected_name = COALESCE(excluded.corrected_name, food_corrections.corrected_name),
    corrected_grams = excluded.corrected_grams,
    use_count = food_corrections.use_count + 1,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_food_correction FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_food_correction TO authenticated;

DROP FUNCTION IF EXISTS public.add_food_entry(uuid, date, jsonb);
DROP FUNCTION IF EXISTS public.add_food_entry(uuid, date, integer, jsonb);

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

REVOKE EXECUTE ON FUNCTION public.add_food_entry FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_food_entry TO authenticated;
