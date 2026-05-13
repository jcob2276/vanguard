const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pdvqkgfsqziqlhptatgf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ0NzgsImV4cCI6MjA5Mjk2MDQ3OH0.vM69FS8w1K3N_eJjD7LLYxi59T2xCnMH1STEsAICyqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: messages, error: e1 } = await supabase
    .from('ai_chat_messages')
    .select('role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: stream, error: e2 } = await supabase
    .from('vanguard_stream')
    .select('content, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('--- LATEST CHAT MESSAGES ---');
  console.log(JSON.stringify(messages, null, 2));
  console.log('--- LATEST STREAM ---');
  console.log(JSON.stringify(stream, null, 2));
}

check();
