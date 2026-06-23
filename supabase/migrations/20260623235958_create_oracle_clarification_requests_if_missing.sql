CREATE TABLE IF NOT EXISTS oracle_clarification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  response_type TEXT NOT NULL CHECK (response_type IN ('confirm','single_choice','multi_choice','short_text')),
  options JSONB DEFAULT '[]',
  dedupe_key TEXT NOT NULL,
  evidence_fact_ids TEXT[] DEFAULT '{}',
  proposed_memory TEXT,
  confidence FLOAT DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','dismissed')),
  answer JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

ALTER TABLE oracle_clarification_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oracle_clarification_requests' AND policyname = 'user own'
  ) THEN
    CREATE POLICY "user own" ON oracle_clarification_requests FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_clarification_user_status ON oracle_clarification_requests(user_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname = 'idx_clarification_dedupe' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX idx_clarification_dedupe ON oracle_clarification_requests(user_id, dedupe_key) WHERE status = 'pending';
  END IF;
END
$$;
