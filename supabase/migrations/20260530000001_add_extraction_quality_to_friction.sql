-- Add extraction_quality to make prompt vs reality drift visible in friction pipeline
ALTER TABLE friction_events
  ADD COLUMN IF NOT EXISTS extraction_quality integer;

COMMENT ON COLUMN friction_events.extraction_quality IS 
  'How complete the rich extraction was (0-100). Used to surface drift between auto-classify prompt and actual DB data.';
