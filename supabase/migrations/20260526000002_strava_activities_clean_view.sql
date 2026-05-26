-- strava_activities_clean
-- Deduplicates Oura-synced vs manual activity pairs (within 15 min, same sport_type).
-- Rule:
--   • Keep the manual/GPS entry as primary row
--   • Pull average_heartrate + max_heartrate from the Oura pair if manual has none
--   • Oura-only entries (no manual counterpart) are kept as-is
--   • Oura entries that have a manual counterpart within 15 min are excluded

CREATE OR REPLACE VIEW strava_activities_clean AS
WITH tagged AS (
  SELECT
    *,
    (name ILIKE '%oura%') AS is_oura
  FROM strava_activities
),
enriched AS (
  SELECT
    a.strava_id,
    a.user_id,
    a.name,
    a.sport_type,
    a.start_date,
    a.elapsed_time,
    a.moving_time,
    a.distance,
    a.average_speed,
    a.max_speed,
    a.total_elevation_gain,
    a.calories,
    a.suffer_score,
    a.manual,
    a.is_oura,
    -- HR: from this activity, or pull from Oura pair if missing
    COALESCE(
      a.average_heartrate,
      (SELECT o.average_heartrate
       FROM tagged o
       WHERE o.user_id       = a.user_id
         AND o.sport_type    = a.sport_type
         AND o.is_oura       = true
         AND o.average_heartrate IS NOT NULL
         AND ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date))) < 900
       ORDER BY ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date)))
       LIMIT 1)
    ) AS average_heartrate,
    COALESCE(
      a.max_heartrate,
      (SELECT o.max_heartrate
       FROM tagged o
       WHERE o.user_id       = a.user_id
         AND o.sport_type    = a.sport_type
         AND o.is_oura       = true
         AND o.max_heartrate IS NOT NULL
         AND ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date))) < 900
       ORDER BY ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date)))
       LIMIT 1)
    ) AS max_heartrate,
    a.synced_at
  FROM tagged a
  WHERE
    -- Drop Oura entries that have a manual counterpart within 15 min
    NOT (
      a.is_oura = true
      AND EXISTS (
        SELECT 1 FROM tagged b
        WHERE b.user_id    = a.user_id
          AND b.sport_type = a.sport_type
          AND b.is_oura    = false
          AND ABS(EXTRACT(EPOCH FROM (b.start_date - a.start_date))) < 900
      )
    )
)
SELECT * FROM enriched;
