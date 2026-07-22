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
  // Check strava_tokens
  const { data: stravaTokens } = await supabase.from('strava_tokens').select('*');
  console.log("=== STRAVA TOKENS ===");
  console.log(JSON.stringify(stravaTokens, null, 2));

  // Check intervals_tokens / vanguard_tokens
  const { data: vanguardTokens } = await supabase.from('vanguard_tokens').select('*');
  console.log("=== VANGUARD TOKENS ===");
  console.log(JSON.stringify(vanguardTokens, null, 2));

  // Check user_settings
  const { data: userSettings } = await supabase.from('user_settings').select('*');
  console.log("=== USER SETTINGS ===");
  console.log(JSON.stringify(userSettings, null, 2));
}

main();
