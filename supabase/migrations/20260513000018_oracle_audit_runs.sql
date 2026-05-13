-- ============================================================
-- VANGUARD OS — ORACLE AUDIT ENGINE
-- Cel: Implementacja "Czarnej Skrzynki" dla każdego zapytania Oracle.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vanguard_oracle_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  query text NOT NULL,
  intent text,
  answer text,
  confidence text,
  claims jsonb DEFAULT '[]'::jsonb,
  sources jsonb DEFAULT '[]'::jsonb,
  retrieved_context jsonb DEFAULT '[]'::jsonb,
  state_vector jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vanguard_oracle_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polname = 'Users own oracle runs'
    ) THEN
        CREATE POLICY "Users own oracle runs"
        ON public.vanguard_oracle_runs FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Indeksy dla analityki
CREATE INDEX IF NOT EXISTS idx_oracle_runs_user_date ON public.vanguard_oracle_runs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_runs_intent ON public.vanguard_oracle_runs(intent);
