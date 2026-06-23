-- food_library is the user's personal product cache, searched before falling
-- back to Open Food Facts. Diet is highly repetitive — a few hundred products
-- cover almost everything actually eaten — so once a product is in here,
-- search no longer depends on OFF having (or correctly indexing) it.
-- Distinct from food_favorites, which is curated by actual repeat usage and
-- drives the favorites/quick-repeat UI; this table is a broader name-searchable
-- catalog, seeded once from historical Yazio export data and grown over time.
CREATE TABLE public.food_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  barcode text,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugar numeric,
  default_grams integer NOT NULL DEFAULT 100,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX food_library_user_name_brand_key
  ON public.food_library (user_id, name, COALESCE(brand, ''));

ALTER TABLE public.food_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.food_library FOR ALL USING (auth.uid() = user_id);
