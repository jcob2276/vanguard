-- daily_strain: readiness level from NOOP ReadinessEngine port
-- Stores synthesized readiness: primed | balanced | strained | rundown | insufficient
-- readiness_signals stored inside existing components JSONB (no extra column needed)

ALTER TABLE public.daily_strain
  ADD COLUMN IF NOT EXISTS readiness_level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_strain_readiness_level_check'
      AND conrelid = 'public.daily_strain'::regclass
  ) THEN
    ALTER TABLE public.daily_strain
      ADD CONSTRAINT daily_strain_readiness_level_check
      CHECK (
        readiness_level IS NULL
        OR readiness_level IN ('primed', 'balanced', 'strained', 'rundown', 'insufficient')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.daily_strain.readiness_level IS
  'ReadinessEngine (NOOP port): primed | balanced | strained | rundown | insufficient. Synthesizes HRV z-score, RHR drift, ACWR, training monotony.';
