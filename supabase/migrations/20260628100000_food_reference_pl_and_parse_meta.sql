-- Polish reference foods + parse provenance on logged entries

CREATE TABLE IF NOT EXISTS public.food_reference_pl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  calories integer NOT NULL,
  protein numeric NOT NULL,
  carbs numeric NOT NULL,
  fat numeric NOT NULL,
  fiber numeric,
  sugar numeric,
  source_label text NOT NULL DEFAULT 'curated_pl'
);

ALTER TABLE public.food_reference_pl ENABLE ROW LEVEL SECURITY;
-- Read-only for authenticated; writes via migrations/service role only

CREATE POLICY "food_reference_pl_read" ON public.food_reference_pl
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.food_reference_pl (name, calories, protein, carbs, fat) VALUES
  ('Bigos', 61, 4, 3, 4),
  ('Gołąbki', 108, 6, 9, 5.5),
  ('Lazania', 132, 8.5, 12, 5.5),
  ('Gulasz wołowy', 95, 12, 3, 4),
  ('Spaghetti Bolognese', 132, 7, 18, 3.5),
  ('Ryba z frytkami', 195, 9.5, 22, 7.5),
  ('Hummus', 177, 5, 14, 11),
  ('Kebab', 215, 12, 18, 10.5),
  ('Sajgonki', 250, 6, 28, 12.5),
  ('Sałatka ziemniaczana z majonezem', 143, 1.5, 12, 10),
  ('Kotlet schabowy smażony', 270, 17, 8, 19),
  ('Kotlet mielony smażony', 250, 16, 5, 18),
  ('Pierogi ruskie gotowane', 200, 6, 35, 4),
  ('Pizza Margherita', 250, 10, 30, 10),
  ('Zupa pomidorowa', 38, 1.2, 5.5, 1.2),
  ('Zupa krupnik', 48, 2.5, 5, 2),
  ('Rosół', 35, 3.5, 1, 2),
  ('Barszcz czerwony', 40, 1.5, 6, 1),
  ('Karkówka domowa duszona', 250, 24, 0, 17),
  ('Naleśniki z serem', 174, 7, 22, 6.5),
  ('Jajecznica', 154, 11, 1.5, 12),
  ('Owsianka na mleku', 88, 3.5, 12, 3)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.daily_food_entries
  ADD COLUMN IF NOT EXISTS parse_meta jsonb;

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
  -- Service role (Telegram): auth.uid() IS NULL — allow when JWT is service role
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  v_group := NULLIF(p_entry->>'meal_group_id', '')::uuid;

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, meal_type, amount, logged_at, meal_group_id, parse_meta
  ) VALUES (
    p_user_id, p_date,
    p_entry->>'name', p_entry->>'brand',
    ROUND((p_entry->>'calories')::numeric * v_scale)::integer,
    ROUND((p_entry->>'protein')::numeric * v_scale, 1),
    ROUND((p_entry->>'carbs')::numeric * v_scale, 1),
    ROUND((p_entry->>'fat')::numeric * v_scale, 1),
    ROUND((p_entry->>'fiber')::numeric * v_scale, 1),
    ROUND((p_entry->>'sugar')::numeric * v_scale, 1),
    p_entry->>'meal_type', p_grams || ' g', now(), v_group,
    p_entry->'parse_meta'
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

REVOKE EXECUTE ON FUNCTION public.add_food_entry FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_food_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_food_entry TO service_role;
