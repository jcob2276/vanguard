-- Migration: Add scheduling and reminders to supplements
ALTER TABLE public.supplements
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS reminder_time time,
  ADD COLUMN IF NOT EXISTS reminder_sent_date date,
  ADD COLUMN IF NOT EXISTS skip_qty boolean NOT NULL DEFAULT false;

-- Seed the new supplement for the user
DO $$
DECLARE
  uid uuid;
  supl_id uuid;
BEGIN
  SELECT user_id INTO uid FROM public.user_settings LIMIT 1;
  IF uid IS NULL THEN RETURN; END IF;

  -- 1. Insert/upsert the supplement
  INSERT INTO public.supplements (user_id, slug, name, emoji, unit, dose_per_unit, sort_order, active, start_date, end_date, reminder_time, skip_qty)
  VALUES (
    uid,
    'pylek_wit_c',
    'Pyłek kwiatowy + Witamina C',
    '🐝',
    'porcja',
    '{"pylek_g": 5, "wit_c_mg": 1000}'::jsonb,
    6,
    true,
    '2026-07-03'::date,
    '2026-07-24'::date,
    '08:00:00'::time,
    true
  )
  ON CONFLICT (user_id, slug) DO UPDATE SET
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    reminder_time = EXCLUDED.reminder_time,
    skip_qty = EXCLUDED.skip_qty
  RETURNING id INTO supl_id;

  -- 2. Log intake for the last 3 days: 2026-07-03, 2026-07-04, 2026-07-05
  IF NOT EXISTS (SELECT 1 FROM public.supplement_logs WHERE user_id = uid AND supplement_id = supl_id AND date = '2026-07-03') THEN
    INSERT INTO public.supplement_logs (user_id, supplement_id, quantity, date, logged_at)
    VALUES (uid, supl_id, 1, '2026-07-03', '2026-07-03 08:15:00+02'::timestamptz);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.supplement_logs WHERE user_id = uid AND supplement_id = supl_id AND date = '2026-07-04') THEN
    INSERT INTO public.supplement_logs (user_id, supplement_id, quantity, date, logged_at)
    VALUES (uid, supl_id, 1, '2026-07-04', '2026-07-04 08:20:00+02'::timestamptz);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.supplement_logs WHERE user_id = uid AND supplement_id = supl_id AND date = '2026-07-05') THEN
    INSERT INTO public.supplement_logs (user_id, supplement_id, quantity, date, logged_at)
    VALUES (uid, supl_id, 1, '2026-07-05', '2026-07-05 08:10:00+02'::timestamptz);
  END IF;
END $$;
