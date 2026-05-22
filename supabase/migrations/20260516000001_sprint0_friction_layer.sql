-- =============================================================
-- Sprint 0: Clean Current Layer
-- 1. friction_events — atomowe mikrotarcia
-- 2. temporal_status na vanguard_entity_links
-- 3. Backfill: stare krawędzie → unknown/stale/hypothesis
-- =============================================================

-- ---- 1. friction_events ----

CREATE TABLE IF NOT EXISTS friction_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  stream_record_id   uuid REFERENCES vanguard_stream(id) ON DELETE SET NULL,
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  raw_text           text,
  friction_type      text CHECK (friction_type IN (
    'avoidance', 'procrastination', 'emotional_spike',
    'habit_break', 'social_withdrawal', 'sleep_disruption', 'other'
  )),
  context            jsonb    DEFAULT '{}',
  cost_estimate      text,
  confidence_source  text     DEFAULT 'self_report' CHECK (confidence_source IN (
    'self_report', 'inferred', 'biometric'
  )),
  confidence         float    DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  created_at         timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE friction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own friction events"
  ON friction_events FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass friction_events"
  ON friction_events FOR ALL TO service_role
  USING (true);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_friction_events_user_occurred
  ON friction_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_friction_events_type
  ON friction_events(user_id, friction_type);


-- ---- 2. temporal_status na vanguard_entity_links ----

ALTER TABLE vanguard_entity_links
  ADD COLUMN IF NOT EXISTS temporal_status text
  DEFAULT 'current'
  CHECK (temporal_status IN (
    'current', 'historical', 'declared', 'hypothesis', 'stale', 'unknown'
  ));

-- ---- 3. Backfill ----

-- Krawędzie bez proweniencji → unknown
UPDATE vanguard_entity_links
SET temporal_status = 'unknown'
WHERE source_episode_id IS NULL
  AND temporal_status = 'current';

-- memory_type = hypothesis → hypothesis
UPDATE vanguard_entity_links
SET temporal_status = 'hypothesis'
WHERE memory_type = 'hypothesis'
  AND temporal_status NOT IN ('stale', 'deprecated', 'historical');

-- Stare (>60 dni) i bez proweniencji → stale
UPDATE vanguard_entity_links
SET temporal_status = 'stale'
WHERE temporal_status = 'unknown'
  AND valid_from < now() - interval '60 days';

-- Krawędzie z proweniencją ale stare >30 dni → historical (nie stale — mają dowód)
UPDATE vanguard_entity_links
SET temporal_status = 'historical'
WHERE source_episode_id IS NOT NULL
  AND temporal_status = 'current'
  AND valid_from < now() - interval '30 days';
