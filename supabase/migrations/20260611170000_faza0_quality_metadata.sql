-- ============================================================================
-- FAZA 0 — Quality Metadata & Versioning Columns
-- Date: 2026-06-11
--
-- Adds columns for prompt versioning and quality audit metadata:
-- 1. friction_events.parser_version, extraction_quality_score, last_reviewed_at, review_notes
-- 2. daily_reconciliations.p2_parser_version, evening_extraction_version
-- ============================================================================

-- 1. Add columns to friction_events
ALTER TABLE public.friction_events
  ADD COLUMN IF NOT EXISTS parser_version             text,
  ADD COLUMN IF NOT EXISTS extraction_quality_score   integer,
  ADD COLUMN IF NOT EXISTS last_reviewed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes               text;

-- 2. Add columns to daily_reconciliations
ALTER TABLE public.daily_reconciliations
  ADD COLUMN IF NOT EXISTS p2_parser_version          text,
  ADD COLUMN IF NOT EXISTS evening_extraction_version text;

-- Add comments for documentation
COMMENT ON COLUMN public.friction_events.parser_version IS 'Version of the prompt/extractor that produced this friction event (e.g. auto-classify-v41).';
COMMENT ON COLUMN public.friction_events.extraction_quality_score IS 'Manual audit score (0-100) assigned during quality reviews.';
COMMENT ON COLUMN public.friction_events.last_reviewed_at IS 'Timestamp of the last manual quality review/audit.';
COMMENT ON COLUMN public.friction_events.review_notes IS 'Notes or annotations from the quality auditor.';

COMMENT ON COLUMN public.daily_reconciliations.p2_parser_version IS 'Version of the P2 parser prompt (e.g. p2-parser-v1).';
COMMENT ON COLUMN public.daily_reconciliations.evening_extraction_version IS 'Version of the legacy evening extraction prompt.';
