-- ============================================================================
-- CREATE vanguard_behavioral_patterns
-- Date: 2026-06-02
--
-- Dedicated table for Etap 1 Personal Pattern Memory.
-- Replaces the temporary usage of vanguard_curiosity_queue (category='behavioral_pattern').
--
-- Safe to run multiple times.
-- ============================================================================

-- ─── vanguard_behavioral_patterns ───────────────────────────────────────────
-- Stores user-specific behavioral patterns detected by the system
-- (recurring blockers, plan adherence gaps, morning protocol effects, etc.).
--
-- Written by detectors in vanguardPatterns.ts (during reconciliation).
-- Read by: morning-brief, oracle, weekly-synthesis.
-- Updated via user feedback (patternFeedback handler).

CREATE TABLE IF NOT EXISTS public.vanguard_behavioral_patterns (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  pattern_type      text        NOT NULL,           -- 'recurring_blocker' | 'plan_adherence_gap' | 'morning_protocol_impact' | ...
  signature         text        NOT NULL,           -- deduplication key (normalized text or hash of conditions)

  title             text,
  evidence_text     text        NOT NULL,           -- the exact text shown to user

  first_seen        date,
  last_seen         date,
  occurrence_count  integer     DEFAULT 1,

  confidence        numeric     DEFAULT 0.6 CHECK (confidence >= 0 AND confidence <= 1),
  status            text        DEFAULT 'pending' CHECK (status IN (
                              'pending', 'visible', 'user_confirmed', 'user_rejected',
                              'snoozed', 'archived'
                            )),

  metadata          jsonb       DEFAULT '{}',       -- extra data: blocker phrase, deltas, etc.
  user_notes        text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One pattern per user + signature (prevents duplicates on re-detection)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vanguard_behavioral_patterns_user_signature
  ON public.vanguard_behavioral_patterns (user_id, signature);

CREATE INDEX IF NOT EXISTS idx_vanguard_behavioral_patterns_user_status
  ON public.vanguard_behavioral_patterns (user_id, status, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_vanguard_behavioral_patterns_user_type
  ON public.vanguard_behavioral_patterns (user_id, pattern_type, confidence DESC);

ALTER TABLE public.vanguard_behavioral_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own behavioral patterns" ON public.vanguard_behavioral_patterns;
CREATE POLICY "Users can manage own behavioral patterns"
  ON public.vanguard_behavioral_patterns
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access (edge functions)
DROP POLICY IF EXISTS "Service role bypass behavioral patterns" ON public.vanguard_behavioral_patterns;
CREATE POLICY "Service role bypass behavioral patterns"
  ON public.vanguard_behavioral_patterns
  FOR ALL TO service_role
  USING (true);

COMMENT ON TABLE public.vanguard_behavioral_patterns IS
  'Etap 1: Personal Pattern Memory. Stores detected recurring behavioral patterns with user feedback. '
  'Written primarily during evening reconciliation. Read by morning-brief, Oracle, and weekly synthesis.';

COMMENT ON COLUMN public.vanguard_behavioral_patterns.signature IS
  'Stable key for deduplication (e.g. normalized blocker text or combination of conditions).';

COMMENT ON COLUMN public.vanguard_behavioral_patterns.status IS
  'pending | visible | user_confirmed | user_rejected | snoozed | archived';

-- Backfill note:
-- Stare rekordy z vanguard_curiosity_queue (category = 'behavioral_pattern')
-- można przenieść ręcznie lub przez jednorazowy skrypt, jeśli będzie potrzeba.
-- Na razie nowe wzorce idą tylko do tej tabeli.
