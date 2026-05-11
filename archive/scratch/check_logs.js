import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pdvqkgfsqziqlhptatgf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4NDQ3OCwiZXhwIjoyMDkyOTYwNDc4fQ.lmEaTT7CmrMtdsM9EMyPY6HU8ZnDWYKQSYTr-mGkbTA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkLogs() {
    const { data, error } = await supabase
        .from('vanguard_stream')
        .select('*', { count: 'exact' })
        .limit(20)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log(`Found ${data.length} logs for today:`);
    data.forEach(log => {
        console.log(`[${log.created_at}] [${log.classification}] ${log.content}`);
    });
}

checkLogs();
