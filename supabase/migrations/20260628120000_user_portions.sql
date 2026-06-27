-- Tabela do przechowywania własnych rozmiarów porcji i sztuk per użytkownik
-- Pozwala to LLM na deterministyczne rozwiązywanie zapytań typu "1 duży kebab" -> 450g

CREATE TABLE IF NOT EXISTS public.user_portions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  grams integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.user_portions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_portions_read" ON public.user_portions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_portions_insert" ON public.user_portions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_portions_update" ON public.user_portions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_portions_delete" ON public.user_portions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
