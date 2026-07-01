const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  // Get user ID
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  
  let userId;
  if (users && users.length > 0) {
    userId = users[0].id;
  } else {
    // If we can't use admin api (it's anon key), try to login as Jakub or assume there's a way.
    // Wait, with ANON key we can't list users easily unless we log in.
    console.error("Cannot list users with ANON key. Please run inside authenticated context or use service role key.");
    process.exit(1);
  }
}

seed();
