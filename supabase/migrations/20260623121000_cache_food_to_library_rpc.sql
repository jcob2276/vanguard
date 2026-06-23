-- food_library's unique index is on (user_id, name, COALESCE(brand, '')), an
-- expression PostgREST's .upsert() on_conflict can't target directly — needs
-- a plain SQL ON CONFLICT, same reason food_favorites' upserts go through RPCs.
CREATE OR REPLACE FUNCTION public.cache_food_to_library(
  p_user_id uuid,
  p_name text,
  p_brand text,
  p_barcode text,
  p_calories numeric,
  p_protein numeric,
  p_carbs numeric,
  p_fat numeric,
  p_fiber numeric,
  p_sugar numeric,
  p_default_grams integer
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.food_library
    (user_id, name, brand, barcode, calories, protein, carbs, fat, fiber, sugar, default_grams, source)
  VALUES
    (p_user_id, p_name, p_brand, p_barcode, p_calories, p_protein, p_carbs, p_fat, p_fiber, p_sugar, p_default_grams, 'logged')
  ON CONFLICT (user_id, name, COALESCE(brand, '')) DO NOTHING;
$$;
