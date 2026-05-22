-- =============================================================
-- Human Gate for LLM-driven closure (Sprint 0 safety layer)
--
-- Zasada: inference nie może mutować evidence layer bez human confirmation.
-- Zamiast pisać valid_until bezpośrednio do vanguard_stream,
-- auto-classify tworzy propozycję. Faktyczny UPDATE następuje
-- dopiero po status='approved' (P3, osobny flow).
-- =============================================================

CREATE TABLE IF NOT EXISTS vanguard_stream_closure_proposals (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL,
  proposed_by_record_id     uuid        REFERENCES vanguard_stream(id) ON DELETE SET NULL,
  target_record_ids         uuid[]      NOT NULL,
  closed_topic_description  text        NOT NULL,
  similarity_threshold      float       NOT NULL DEFAULT 0.65,
  status                    text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  resolved_at               timestamptz
);

-- RLS
ALTER TABLE vanguard_stream_closure_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own closure proposals"
  ON vanguard_stream_closure_proposals FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass closure_proposals"
  ON vanguard_stream_closure_proposals FOR ALL TO service_role
  USING (true);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_closure_proposals_user_status
  ON vanguard_stream_closure_proposals (user_id, status);

CREATE INDEX IF NOT EXISTS idx_closure_proposals_proposed_by
  ON vanguard_stream_closure_proposals (proposed_by_record_id);
