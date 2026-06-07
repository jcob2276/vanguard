-- Canonical Vanguard migration pattern.
--
-- Key invariants:
--   1. RLS enabled on every new table
--   2. Policy per operation (SELECT / INSERT / UPDATE) — never a blanket policy
--   3. Warsaw timezone in SQL: (now() AT TIME ZONE 'Europe/Warsaw')::date::text
--      NOT current_date::text (that's UTC server time)
--   4. Idempotent: IF NOT EXISTS / OR REPLACE / ON CONFLICT DO NOTHING
--   5. Timestamp columns: timestamptz not timestamp
--   6. Soft-delete or audit columns use timestamptz DEFAULT now()

-- ─── New table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS example_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        text NOT NULL,                          -- 'YYYY-MM-DD' in Warsaw tz
  value       numeric,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS (CRITICAL — every new table must have this) ─────────────────────────
ALTER TABLE example_entries ENABLE ROW LEVEL SECURITY;

-- Users see only their own rows
CREATE POLICY "user_select" ON example_entries
  FOR SELECT USING (auth.uid() = user_id);

-- Users insert only their own rows
CREATE POLICY "user_insert" ON example_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users update only their own rows
CREATE POLICY "user_update" ON example_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── Index ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_example_entries_user_date
  ON example_entries (user_id, date DESC);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_example_updated_at ON example_entries;
CREATE TRIGGER trg_example_updated_at
  BEFORE UPDATE ON example_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── Upsert example using Warsaw date ────────────────────────────────────────
-- For reference — use this pattern in RPCs and edge functions:
--
-- INSERT INTO example_entries (user_id, date, value)
-- VALUES (
--   $1,
--   (now() AT TIME ZONE 'Europe/Warsaw')::date::text,  -- Warsaw today
--   $2
-- )
-- ON CONFLICT (user_id, date) DO UPDATE SET value = EXCLUDED.value;
