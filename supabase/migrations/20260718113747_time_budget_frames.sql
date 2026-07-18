ALTER TABLE public.vanguard_time_budgets
  ADD COLUMN IF NOT EXISTS preferred_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_start time,
  ADD COLUMN IF NOT EXISTS preferred_end time,
  ADD COLUMN IF NOT EXISTS frame_strength text NOT NULL DEFAULT 'prefer';

ALTER TABLE public.vanguard_time_budgets
  DROP CONSTRAINT IF EXISTS vanguard_time_budgets_frame_strength_check,
  ADD CONSTRAINT vanguard_time_budgets_frame_strength_check
    CHECK (frame_strength IN ('prefer', 'only')),
  DROP CONSTRAINT IF EXISTS vanguard_time_budgets_preferred_days_check,
  ADD CONSTRAINT vanguard_time_budgets_preferred_days_check
    CHECK (preferred_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  DROP CONSTRAINT IF EXISTS vanguard_time_budgets_preferred_time_check,
  ADD CONSTRAINT vanguard_time_budgets_preferred_time_check
    CHECK (
      preferred_start IS NULL
      OR preferred_end IS NULL
      OR preferred_start < preferred_end
    );

COMMENT ON COLUMN public.vanguard_time_budgets.preferred_days IS
  'ISO weekdays (1=Monday, 7=Sunday) used as a soft planning preference.';
COMMENT ON COLUMN public.vanguard_time_budgets.frame_strength IS
  'prefer = suggestion context; only = warn when planning outside the frame. Never auto-moves items.';
