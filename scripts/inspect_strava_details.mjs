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
  console.log("=== INVOKING sync SERVICE=strava ===");
  try {
    const res = await fetch(`${url}/functions/v1/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ service: 'strava' })
    });
    const text = await res.text();
    console.log("sync strava response:", text);
  } catch (err) {
    console.error("sync strava error:", err);
  }

  // Check strava_activities table
  const { data: stravaRaw } = await supabase
    .from('strava_activities')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(5);

  console.log("\n=== strava_activities (latest 5) ===");
  console.log(JSON.stringify(stravaRaw, null, 2));

  // Check workout_sessions table
  const { data: workoutSessions } = await supabase
    .from('workout_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log("\n=== workout_sessions (latest 5) ===");
  console.log(JSON.stringify(workoutSessions, null, 2));
}

main();
