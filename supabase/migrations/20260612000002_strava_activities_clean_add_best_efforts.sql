-- Add best_efforts (from raw_data) to strava_activities_clean view

DROP VIEW IF EXISTS strain_correlations;
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
    a.raw_data->'best_efforts'                               AS best_efforts,
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

CREATE VIEW strain_correlations AS
WITH strava_day AS (
  SELECT
    user_id,
    (start_date AT TIME ZONE 'Europe/Warsaw')::date AS day,
    avg(hr_avg)              AS run_hr,
    max(perceived_exertion)  AS run_rpe,
    avg(cadence_spm)         AS run_cadence
  FROM strava_activities_clean
  WHERE is_oura = false AND sport_type ILIKE '%run%'
  GROUP BY user_id, (start_date AT TIME ZONE 'Europe/Warsaw')::date
),
daily AS (
  SELECT
    ds.user_id,
    ds.date                AS day,
    ds.strain_score,
    ds.fueling_score,
    ds.leg_load,
    ds.strength_load,
    s.readiness_score,
    s.hrv_avg,
    s.total_sleep_hours,
    n.calories,
    n.carbs,
    sd.run_hr,
    sd.run_rpe,
    sd.run_cadence
  FROM daily_strain ds
  LEFT JOIN oura_daily_summary  s  ON s.user_id  = ds.user_id AND s.date  = ds.date
  LEFT JOIN daily_nutrition     n  ON n.user_id  = ds.user_id AND n.date  = ds.date
  LEFT JOIN strava_day          sd ON sd.user_id = ds.user_id AND sd.day  = ds.date
),
pairs AS (
  SELECT
    t.*,
    nx.hrv_avg          AS next_hrv,
    nx.readiness_score  AS next_readiness,
    nx.run_cadence      AS next_cadence,
    nx.run_hr           AS next_run_hr
  FROM daily t
  LEFT JOIN daily nx ON nx.user_id = t.user_id AND nx.day = t.day + 1
)
SELECT
  user_id,
  count(*)                                                          AS n_dni,
  round(corr(strain_score::float,  next_hrv)::numeric,         2)  AS strain_to_jutro_hrv,
  round(corr(strain_score::float,  next_readiness::float)::numeric, 2) AS strain_to_jutro_readiness,
  round(corr(fueling_score::float, run_hr)::numeric,            2)  AS fueling_to_hr_biegu,
  round(corr(calories::float,      run_rpe)::numeric,           2)  AS kcal_to_rpe,
  round(corr(carbs::float,         run_rpe)::numeric,           2)  AS wegle_to_rpe,
  round(corr(total_sleep_hours::float, readiness_score::float)::numeric, 2) AS sen_to_readiness,
  round(corr(leg_load::float,      next_cadence::float)::numeric, 2) AS nogi_to_jutro_kadencja,
  round(corr(leg_load::float,      next_run_hr)::numeric,       2)  AS nogi_to_jutro_hr_biegu
FROM pairs
GROUP BY user_id;
