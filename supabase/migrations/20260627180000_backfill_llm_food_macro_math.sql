-- Backfill: NL/LLM-style food entries (brand IS NULL) — spójne kcal z B/W/T (4-4-9).
-- Skany z etykietą (brand NOT NULL) nie są dotykane.

CREATE TEMP TABLE _food_macro_backfill_days (
  user_id uuid NOT NULL,
  date date NOT NULL,
  PRIMARY KEY (user_id, date)
) ON COMMIT DROP;

WITH candidates AS (
  SELECT
    id,
    user_id,
    date,
    ROUND(
      COALESCE(protein, 0) * 4
      + COALESCE(carbs, 0) * 4
      + COALESCE(fat, 0) * 9
    )::integer AS new_cal
  FROM public.daily_food_entries
  WHERE brand IS NULL
    AND COALESCE(protein, 0) * 4 + COALESCE(carbs, 0) * 4 + COALESCE(fat, 0) * 9 > 0
    AND calories IS DISTINCT FROM ROUND(
      COALESCE(protein, 0) * 4 + COALESCE(carbs, 0) * 4 + COALESCE(fat, 0) * 9
    )
),
updated AS (
  UPDATE public.daily_food_entries e
  SET calories = c.new_cal
  FROM candidates c
  WHERE e.id = c.id
  RETURNING e.user_id, e.date
)
INSERT INTO _food_macro_backfill_days (user_id, date)
SELECT DISTINCT user_id, date FROM updated;

DO $$
DECLARE
  r RECORD;
  n integer := 0;
BEGIN
  SELECT COUNT(*) INTO n FROM _food_macro_backfill_days;
  RAISE NOTICE 'food macro backfill: % user-days to recompute', n;

  FOR r IN SELECT user_id, date FROM _food_macro_backfill_days LOOP
    PERFORM public._recompute_daily_nutrition(r.user_id, r.date);
  END LOOP;
END;
$$;
