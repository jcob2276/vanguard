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
  console.log("Checking tables in Supabase...");
  
  // 1. strava_activities_clean
  const { data: stravaClean, error: e1 } = await supabase
    .from('strava_activities_clean')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(5);
  
  console.log("=== strava_activities_clean (latest 5) ===");
  if (e1) console.error(e1);
  else console.log(JSON.stringify(stravaClean, null, 2));

  // 2. strava_activities
  const { data: stravaRaw, error: e2 } = await supabase
    .from('strava_activities')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(5);
  
  console.log("=== strava_activities (latest 5) ===");
  if (e2) console.error(e2);
  else console.log(JSON.stringify(stravaRaw, null, 2));

  // 3. workout_sessions
  const { data: workouts, error: e3 } = await supabase
    .from('workout_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log("=== workout_sessions (latest 5) ===");
  if (e3) console.error(e3);
  else console.log(JSON.stringify(workouts, null, 2));

  // 4. vanguard_stream
  const { data: stream, error: e4 } = await supabase
    .from('vanguard_stream')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log("=== vanguard_stream (latest 10) ===");
  if (e4) console.error(e4);
  else console.log(JSON.stringify(stream, null, 2));
}

main();
