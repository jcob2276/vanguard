-- vanguard_intentions: declared intentions — strona DEKLARACJI osi deklaracja-vs-działanie
-- (modlitwy, afirmacje, cele). Warstwa praktyki/deklaracji, NIE prawdy.
-- Status zmienia wyłącznie użytkownik. Zob. docs/PRODUCT_PRINCIPLES.md "Transurfing Layer Guardrail".
CREATE TABLE IF NOT EXISTS vanguard_intentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  type TEXT DEFAULT 'slide' CHECK (type IN ('slide', 'prayer', 'affirmation', 'career', 'goal')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'manifested', 'released')),
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  manifested_at TIMESTAMPTZ
);

ALTER TABLE vanguard_intentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own intentions"
  ON vanguard_intentions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_intentions_user_status
  ON vanguard_intentions(user_id, status);
