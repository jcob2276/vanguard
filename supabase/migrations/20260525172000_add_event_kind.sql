-- MIGRACJA: Vanguard OS Stream Observation Kinds (P3)
-- Data: 2026-05-25
-- Cel: Dodanie kolumny event_kind do tabeli friction_events oraz aktualizacja widoku confirmed_friction_events.

-- 1. Dodanie kolumny event_kind, jeśli jeszcze nie istnieje
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS event_kind text DEFAULT 'friction_event';

-- 2. Usunięcie starego constrainta check, jeśli istnieje, i nałożenie nowego
ALTER TABLE public.friction_events DROP CONSTRAINT IF EXISTS friction_events_event_kind_check;
ALTER TABLE public.friction_events ADD CONSTRAINT friction_events_event_kind_check 
  CHECK (event_kind IN (
    'friction_event',
    'positive_micro_action',
    'state_observation',
    'micro_behavior_observation',
    'reflection'
  ));

-- 3. Aktualizacja widoku confirmed_friction_events, by filtrował tylko właściwe tarcia behawioralne i pozytywne gesty
CREATE OR REPLACE VIEW public.confirmed_friction_events AS
  SELECT *
  FROM public.friction_events
  WHERE status IN ('good', 'user_confirmed', 'user_corrected')
    AND event_kind IN ('friction_event', 'positive_micro_action');
