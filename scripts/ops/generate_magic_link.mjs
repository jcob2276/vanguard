import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

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
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    console.error('Error fetching user:', userError);
    process.exit(1);
  }
  
  console.log('Generating magic link for:', user.email);
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: {
      redirectTo: 'http://localhost:5173/'
    }
  });

  if (error) {
    console.error('Error generating link:', error);
    process.exit(1);
  }

  console.log('Link details:', data);
  console.log('Action link:', data.properties.action_link);
}

main().catch(console.error);
