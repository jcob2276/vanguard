CREATE TABLE IF NOT EXISTS knowledge_insight_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  title TEXT NOT NULL,
  insight TEXT,
  widget_type TEXT DEFAULT 'native',
  widget_data JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  related_fact_ids TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE knowledge_insight_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'knowledge_insight_cards' AND policyname = 'user own'
  ) THEN
    CREATE POLICY "user own" ON knowledge_insight_cards
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_insight_cards_user ON knowledge_insight_cards(user_id, sort_order, is_pinned);
