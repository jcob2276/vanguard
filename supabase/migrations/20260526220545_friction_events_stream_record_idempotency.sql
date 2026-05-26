-- Prevent duplicate friction extraction for the same stream record.
-- stream_record_id is nullable for manually created/raw events, so keep the
-- uniqueness partial and only enforce it for classifier-backed events.
CREATE UNIQUE INDEX IF NOT EXISTS idx_friction_events_unique_stream_record
ON public.friction_events(stream_record_id)
WHERE stream_record_id IS NOT NULL;
