import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SB_SECRET_KEY
);

async function run() {
  const userId = process.env.VANGUARD_USER_ID;
  console.log('Querying for user:', userId);

  const { data: summaries, error: e1 } = await supabase
    .from('oura_daily_summary')
    .select('date, hrv_avg, rhr_avg, total_sleep_hours, deep_sleep_hours, rem_sleep_hours, steps')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3);

  const { data: enhanced, error: e2 } = await supabase
    .from('oura_enhanced')
    .select('date, sleep_average_breath, spo2_percentage, light_sleep_hours')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3);

  if (e1) console.error('Error summaries:', e1);
  else console.log('Summaries:', summaries);

  if (e2) console.error('Error enhanced:', e2);
  else console.log('Enhanced:', enhanced);
}

run();
