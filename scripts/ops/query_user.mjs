import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const dotenvPath = './.env';
const envContent = fs.readFileSync(dotenvPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SB_SECRET_KEY; // Using SB_SECRET_KEY as service role
const userId = env.VANGUARD_USER_ID;

console.log('URL:', supabaseUrl);
console.log('Service Key:', serviceRoleKey ? 'present' : 'missing');
console.log('User ID:', userId);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing URL or Service Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  // Query auth.users via supabase.auth.admin
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) {
    console.error('Error fetching user:', userError);
  } else {
    console.log('User email:', user.email);
  }

  // Also check if we can query user_settings
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
  } else {
    console.log('User settings:', settings);
  }
}

main().catch(console.error);
