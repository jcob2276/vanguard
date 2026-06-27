-- workout_day was varchar(10), sized for short letter-codes (A/B/C/D, Push, Pull).
-- The logger UI now suggests free-text names ("Plecy/Bicep...") that overflow it,
-- causing a raw "value too long for type character varying(10)" save failure.
ALTER TABLE public.workout_sessions ALTER COLUMN workout_day TYPE character varying(50);
