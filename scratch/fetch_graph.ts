import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = "https://pdvqkgfsqziqlhptatgf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "REDACTED"; // Pobiorę z env jeśli to możliwe, ale tu wpiszę placeholder
const VANGUARD_USER_ID = "165ae341-670c-46ce-82dc-434c4dbfcdfd";

async function getGraph() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('vanguard_entity_links')
    .select('source_entity, relation, target_entity')
    .eq('user_id', VANGUARD_USER_ID)
    .limit(100);

  if (error) {
    console.error(error);
    return;
  }

  console.log("--- GRAPH DATA START ---");
  console.log(JSON.stringify(data, null, 2));
  console.log("--- GRAPH DATA END ---");
}

getGraph();
