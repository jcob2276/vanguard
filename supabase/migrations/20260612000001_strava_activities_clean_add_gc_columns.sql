-- Add Garmin Connect gc_* columns to strava_activities_clean view

DROP VIEW IF EXISTS strava_activities_clean;

CREATE VIEW strava_activities_clean AS
WITH tagged AS (
  SELECT
    *,
    (name ILIKE '%oura%' OR COALESCE(is_oura_duplicate, false) = true) AS is_oura
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
    a.suffer_score,
    a.perceived_exertion,
    a.manual,
    a.is_oura,
    -- Computed fields
    (a.elapsed_time - a.moving_time)                         AS pause_seconds,
    CASE WHEN a.average_speed > 0
         THEN round(1000.0 / a.average_speed)::int
         ELSE NULL END                                        AS pace_sec_per_km,
    CASE WHEN (a.raw_data->>'average_cadence') IS NOT NULL
         THEN round((a.raw_data->>'average_cadence')::numeric * 2)::int
         ELSE NULL END                                        AS cadence_spm,
    (a.raw_data->>'workout_type')::int                       AS workout_type,
    a.gear_name,
    a.gear_distance_km,
    COALESCE((a.raw_data->>'pr_count')::int, 0) > 0          AS has_pr,
    COALESCE((a.raw_data->>'achievement_count')::int, 0)     AS achievement_count,
    -- HR: pre-resolved > Oura join > native Strava
    COALESCE(
      a.hr_avg,
      (SELECT o.hr_avg
       FROM tagged o
       WHERE o.user_id       = a.user_id
         AND o.sport_type    = a.sport_type
         AND o.is_oura       = true
         AND o.hr_avg        IS NOT NULL
         AND ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date))) < 120
       ORDER BY ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date)))
       LIMIT 1),
      a.average_heartrate
    )                                                         AS hr_avg,
    COALESCE(
      a.hr_max,
      (SELECT o.hr_max
       FROM tagged o
       WHERE o.user_id       = a.user_id
         AND o.sport_type    = a.sport_type
         AND o.is_oura       = true
         AND o.hr_max        IS NOT NULL
         AND ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date))) < 120
       ORDER BY ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date)))
       LIMIT 1),
      a.max_heartrate
    )                                                         AS hr_max,
    COALESCE(
      a.hr_source,
      CASE
        WHEN a.average_heartrate IS NOT NULL THEN 'strava'
        WHEN EXISTS (
          SELECT 1 FROM tagged o
          WHERE o.user_id    = a.user_id
            AND o.sport_type = a.sport_type
            AND o.is_oura    = true
            AND o.hr_avg     IS NOT NULL
            AND ABS(EXTRACT(EPOCH FROM (o.start_date - a.start_date))) < 120
        ) THEN 'oura'
        ELSE NULL
      END
    )                                                         AS hr_source,
    COALESCE(a.hr_frozen, false)                              AS hr_frozen,
    COALESCE(a.splits_with_hr, a.raw_data->'splits_metric')  AS splits_with_hr,
    -- Garmin Connect enrichment
    a.gc_activity_id,
    a.gc_hr_zones,
    a.gc_weather,
    a.gc_laps,
    a.gc_training_effect_aerobic,
    a.gc_training_effect_anaerobic,
    a.gc_vo2max,
    a.gc_enriched_at,
    a.synced_at
  FROM tagged a
  WHERE
    NOT (
      a.is_oura = true
      AND EXISTS (
        SELECT 1 FROM tagged b
        WHERE b.user_id    = a.user_id
          AND b.sport_type = a.sport_type
          AND b.is_oura    = false
          AND ABS(EXTRACT(EPOCH FROM (b.start_date - a.start_date))) < 120
      )
    )
)
SELECT * FROM enriched;
