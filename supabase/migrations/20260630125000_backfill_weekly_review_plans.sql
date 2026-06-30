-- Backfill: old model stored week plan on closing-week row → copy to next week_start.
-- Only fills target rows that are still empty (won't overwrite newer reviews).

INSERT INTO weekly_reviews (
  user_id,
  week_start,
  week_intention,
  week_commitment,
  week_goal_cialo,
  week_goal_duch,
  week_goal_konto
)
SELECT
  s.user_id,
  (s.week_start + INTERVAL '7 days')::date,
  s.week_intention,
  s.week_commitment,
  s.week_goal_cialo,
  s.week_goal_duch,
  s.week_goal_konto
FROM weekly_reviews s
WHERE s.review_completed_at IS NOT NULL
  AND (
    NULLIF(BTRIM(s.week_intention), '') IS NOT NULL
    OR NULLIF(BTRIM(s.week_goal_cialo), '') IS NOT NULL
    OR NULLIF(BTRIM(s.week_goal_duch), '') IS NOT NULL
    OR NULLIF(BTRIM(s.week_goal_konto), '') IS NOT NULL
  )
ON CONFLICT (user_id, week_start) DO UPDATE SET
  week_intention = COALESCE(NULLIF(BTRIM(weekly_reviews.week_intention), ''), EXCLUDED.week_intention),
  week_commitment = COALESCE(NULLIF(BTRIM(weekly_reviews.week_commitment), ''), EXCLUDED.week_commitment),
  week_goal_cialo = COALESCE(NULLIF(BTRIM(weekly_reviews.week_goal_cialo), ''), EXCLUDED.week_goal_cialo),
  week_goal_duch = COALESCE(NULLIF(BTRIM(weekly_reviews.week_goal_duch), ''), EXCLUDED.week_goal_duch),
  week_goal_konto = COALESCE(NULLIF(BTRIM(weekly_reviews.week_goal_konto), ''), EXCLUDED.week_goal_konto);

-- Seed current Warsaw week from the latest row that already has plan fields.
WITH current_monday AS (
  SELECT date_trunc('week', (timezone('Europe/Warsaw', now()))::date)::date AS ws
),
latest_plan AS (
  SELECT DISTINCT ON (user_id) *
  FROM weekly_reviews
  WHERE
    NULLIF(BTRIM(week_intention), '') IS NOT NULL
    OR NULLIF(BTRIM(week_goal_cialo), '') IS NOT NULL
    OR NULLIF(BTRIM(week_goal_duch), '') IS NOT NULL
    OR NULLIF(BTRIM(week_goal_konto), '') IS NOT NULL
  ORDER BY user_id, week_start DESC
)
INSERT INTO weekly_reviews (
  user_id,
  week_start,
  week_intention,
  week_commitment,
  week_goal_cialo,
  week_goal_duch,
  week_goal_konto
)
SELECT
  lp.user_id,
  cm.ws,
  lp.week_intention,
  lp.week_commitment,
  lp.week_goal_cialo,
  lp.week_goal_duch,
  lp.week_goal_konto
FROM latest_plan lp
CROSS JOIN current_monday cm
WHERE NOT EXISTS (
  SELECT 1
  FROM weekly_reviews t
  WHERE t.user_id = lp.user_id
    AND t.week_start = cm.ws
    AND (
      NULLIF(BTRIM(t.week_intention), '') IS NOT NULL
      OR NULLIF(BTRIM(t.week_goal_cialo), '') IS NOT NULL
      OR NULLIF(BTRIM(t.week_goal_duch), '') IS NOT NULL
      OR NULLIF(BTRIM(t.week_goal_konto), '') IS NOT NULL
    )
)
ON CONFLICT (user_id, week_start) DO UPDATE SET
  week_intention = COALESCE(NULLIF(BTRIM(weekly_reviews.week_intention), ''), EXCLUDED.week_intention),
  week_commitment = COALESCE(NULLIF(BTRIM(weekly_reviews.week_commitment), ''), EXCLUDED.week_commitment),
  week_goal_cialo = COALESCE(NULLIF(BTRIM(weekly_reviews.week_goal_cialo), ''), EXCLUDED.week_goal_cialo),
  week_goal_duch = COALESCE(NULLIF(BTRIM(weekly_reviews.week_goal_duch), ''), EXCLUDED.week_goal_duch),
  week_goal_konto = COALESCE(NULLIF(BTRIM(weekly_reviews.week_goal_konto), ''), EXCLUDED.week_goal_konto);
