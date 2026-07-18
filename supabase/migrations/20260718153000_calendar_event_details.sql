ALTER TABLE public.vanguard_calendar
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS recurrence text[],
  ADD COLUMN IF NOT EXISTS series_id text;

COMMENT ON COLUMN public.vanguard_calendar.recurrence IS
  'Google Calendar recurrence rules, e.g. {RRULE:FREQ=WEEKLY;BYDAY=MO,WE}.';
COMMENT ON COLUMN public.vanguard_calendar.series_id IS
  'Google Calendar recurringEventId for an expanded occurrence.';
