
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("--- DIAGNOSTYKA TELEGRAMA ---");
  
  const { data, error } = await supabase
    .from('vanguard_stream')
    .select('created_at, content, source, classification')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error("Błąd bazy:", error);
    return;
  }

  console.log("Ostatnie wpisy w Strumieniu:");
  data.forEach(d => {
    console.log(`[${d.created_at}] [${d.source}] ${d.content.substring(0, 50)}... (${d.classification})`);
  });

  const { data: knowledge } = await supabase
    .from('vanguard_knowledge')
    .select('created_at, title')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log("\nOstatnie wpisy w Wiedzy:");
  knowledge.forEach(k => {
    console.log(`[${k.created_at}] ${k.title}`);
  });
}

check();
