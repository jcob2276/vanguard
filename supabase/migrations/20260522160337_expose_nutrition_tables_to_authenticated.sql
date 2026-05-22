-- Expose Yazio nutrition tables to authenticated clients.
-- The export UI reads these directly with the user's JWT; RLS still limits rows to auth.uid().

ALTER TABLE public.daily_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_food_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_nutrition'
      AND policyname = 'own_data'
  ) THEN
    CREATE POLICY own_data
      ON public.daily_nutrition
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_food_entries'
      AND policyname = 'own_data'
  ) THEN
    CREATE POLICY own_data
      ON public.daily_food_entries
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON public.daily_nutrition TO authenticated;
GRANT SELECT ON public.daily_food_entries TO authenticated;
