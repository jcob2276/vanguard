-- MIGRACJA: Vanguard OS Missing Oracle Context Tables
-- Data: 2026-05-25
-- Cel: Dodanie tabel vanguard_iron_rules, vanguard_repeated_patterns i vanguard_known_persons dla Wyroczni, włączenie RLS i nadanie uprawnień.

-- =========================================================================
-- 1. vanguard_iron_rules (Żelazne Zasady)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vanguard_iron_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content     text NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.vanguard_iron_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own iron rules" ON public.vanguard_iron_rules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass iron_rules" ON public.vanguard_iron_rules
  FOR ALL TO service_role USING (true);

-- =========================================================================
-- 2. vanguard_repeated_patterns (Powtarzalne Wzorce)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vanguard_repeated_patterns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern_name  text NOT NULL,
  description   text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.vanguard_repeated_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own repeated patterns" ON public.vanguard_repeated_patterns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass repeated_patterns" ON public.vanguard_repeated_patterns
  FOR ALL TO service_role USING (true);

-- =========================================================================
-- 3. vanguard_known_persons (Znane Osoby)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vanguard_known_persons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  relation    text NOT NULL,
  context     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.vanguard_known_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own known persons" ON public.vanguard_known_persons
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass known_persons" ON public.vanguard_known_persons
  FOR ALL TO service_role USING (true);
