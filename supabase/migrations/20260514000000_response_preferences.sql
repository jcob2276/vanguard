-- VANGUARD OS â€” RESPONSE PREFERENCES
-- Cel: Przechowywanie instrukcji dotyczacych stylu i tonu odpowiedzi Oracle.

CREATE TABLE IF NOT EXISTS public.vanguard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  key text NOT NULL,
  value text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.vanguard_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_preferences' AND policyname = 'Users own preferences'
  ) THEN
    CREATE POLICY "Users own preferences" ON public.vanguard_preferences FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Wstepne reguly (Anti-Identity Spam)
-- Uzywamy ASCII, aby uniknac problemow z kodowaniem (Ăł, ĹĽ, Ĺ‚ -> o, z, l)
INSERT INTO public.vanguard_preferences (user_id, key, value)
VALUES
  ((SELECT id FROM auth.users LIMIT 1), 'identity_recitation', 'ZAKAZ: Nie zaczynaj odpowiedzi od podawania wieku, daty urodzenia lub kierunku studiow Jakuba, chyba ze o to zapyta.')
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;
