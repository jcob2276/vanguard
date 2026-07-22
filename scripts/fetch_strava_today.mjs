import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.SB_SECRET_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function main() {
  const { data: stravaTokens } = await supabase.from('strava_tokens').select('*').single();
  if (!stravaTokens) {
    console.error("No strava tokens found");
    return;
  }

  let accessToken = stravaTokens.access_token;
  console.log("Using access token:", accessToken);

  // Fetch latest activities from Strava API v3
  let res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.status === 401) {
    console.log("Token expired, refreshing token...");
    // Try to refresh token
    const client_id = env.STRAVA_CLIENT_ID;
    const client_secret = env.STRAVA_CLIENT_SECRET;
    const refreshRes = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        client_secret,
        grant_type: 'refresh_token',
        refresh_token: stravaTokens.refresh_token
      })
    });
    const refreshData = await refreshRes.json();
    console.log("Refresh response:", refreshData);
    if (refreshData.access_token) {
      accessToken = refreshData.access_token;
      // Save back to DB
      await supabase.from('strava_tokens').update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: refreshData.expires_at,
        updated_at: new Date().toISOString()
      }).eq('user_id', stravaTokens.user_id);

      res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    }
  }

  const activities = await res.json();
  console.log(`Fetched ${Array.isArray(activities) ? activities.length : 0} activities from Strava API.`);
  if (Array.isArray(activities)) {
    activities.forEach(act => {
      console.log(`\nID: ${act.id} | Name: ${act.name} | Date: ${act.start_date_local} | Dist: ${act.distance}m | Time: ${act.moving_time}s`);
    });

    if (activities.length > 0) {
      const latestId = activities[0].id;
      console.log(`\nFetching detailed activity & laps for ID: ${latestId}...`);
      const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${latestId}?include_all_efforts=true`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const detail = await detailRes.json();
      console.log("Detail keys:", Object.keys(detail));
      console.log("Name:", detail.name);
      console.log("Distance:", detail.distance);
      console.log("Moving time:", detail.moving_time);
      console.log("Average HR:", detail.average_heartrate);
      console.log("Max HR:", detail.max_heartrate);
      console.log("Average Cadence:", detail.average_cadence);
      console.log("Elevation gain:", detail.total_elevation_gain);
      console.log("Laps count:", detail.laps?.length);

      if (detail.laps) {
        console.log("\n=== LAPS DETAIL ===");
        detail.laps.forEach((lap, idx) => {
          const spd = lap.average_speed;
          const pace_s = spd > 0 ? 1000 / spd : 0;
          const pace_str = pace_s > 0 ? `${Math.floor(pace_s / 60)}:${String(Math.floor(pace_s % 60)).padStart(2, '0')}/km` : '—';
          console.log(`Lap ${idx + 1}: ${lap.name} | Dist: ${lap.distance}m | Time: ${lap.elapsed_time}s | Moving: ${lap.moving_time}s | Pace: ${pace_str} | HR avg: ${lap.average_heartrate} | HR max: ${lap.max_heartrate} | Cad: ${lap.average_cadence}`);
        });
      }

      if (detail.splits_metric) {
        console.log("\n=== SPLITS METRIC (per 1km) ===");
        detail.splits_metric.forEach((split, idx) => {
          const spd = split.average_speed;
          const pace_s = spd > 0 ? 1000 / spd : 0;
          const pace_str = pace_s > 0 ? `${Math.floor(pace_s / 60)}:${String(Math.floor(pace_s % 60)).padStart(2, '0')}/km` : '—';
          console.log(`Split ${idx + 1} (${split.distance}m): Time: ${split.elapsed_time}s | Moving: ${split.moving_time}s | Pace: ${pace_str} | HR avg: ${split.average_heartrate} | Elev difference: ${split.elevation_difference}m`);
        });
      }

      // Fetch streams (time, heartrate, distance, velocity_smooth, cadence, altitude)
      console.log(`\nFetching streams for activity ${latestId}...`);
      const streamRes = await fetch(`https://www.strava.com/api/v3/activities/${latestId}/streams?keys=time,heartrate,distance,velocity_smooth,cadence,altitude&key_by_type=true`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const streams = await streamRes.json();
      console.log("Streams available:", Object.keys(streams));
      // Save details & streams to file for full analysis script if needed!
      fs.writeFileSync('tmp/strava_latest_detail.json', JSON.stringify(detail, null, 2));
      fs.writeFileSync('tmp/strava_latest_streams.json', JSON.stringify(streams, null, 2));
      console.log("Saved detail & streams to tmp/strava_latest_detail.json & tmp/strava_latest_streams.json");
    }
  }
}

main();
