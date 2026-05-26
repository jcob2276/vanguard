-- Strava activities table
CREATE TABLE IF NOT EXISTS strava_activities (
  strava_id       bigint PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text,
  sport_type      text,
  start_date      timestamptz,
  elapsed_time    integer,
  moving_time     integer,
  distance        float,
  average_heartrate float,
  max_heartrate   float,
  average_speed   float,
  max_speed       float,
  total_elevation_gain float,
  calories        float,
  suffer_score    integer,
  perceived_exertion float,
  manual          boolean DEFAULT false,
  raw_data        jsonb,
  synced_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date
  ON strava_activities(user_id, start_date DESC);

-- Token rotation storage (access_token rotates every 6h, refresh_token on every use)
CREATE TABLE IF NOT EXISTS strava_tokens (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token   text NOT NULL,
  access_token    text,
  expires_at      bigint,
  updated_at      timestamptz DEFAULT now()
);

-- Manual setup required: insert Strava tokens via Supabase Dashboard or after OAuth flow.
-- Do NOT seed credentials in migrations — tokens expire and rotate automatically.
-- Run after first OAuth connect:
--   INSERT INTO strava_tokens (user_id, refresh_token, access_token, expires_at)
--   VALUES ('<user_id>', '<refresh_token>', '<access_token>', <expires_at_unix>)
--   ON CONFLICT (user_id) DO UPDATE SET
--     refresh_token = EXCLUDED.refresh_token,
--     access_token  = EXCLUDED.access_token,
--     expires_at    = EXCLUDED.expires_at,
--     updated_at    = now();
