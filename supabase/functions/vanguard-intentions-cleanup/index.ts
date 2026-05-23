import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pobierz wszystkich użytkowników (lub konkretnego, jeśli przekazany)
    const { data: users } = await supabase.from('user_settings').select('user_id');
    
    const results = [];

    for (const { user_id } of (users || [])) {
      console.log(`[Vanguard] Checking intentions for user: ${user_id}`);

      // 1. Pobierz aktywne intencje
      const { data: intentions } = await supabase
        .from('vanguard_intentions')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active');

      if (!intentions || intentions.length === 0) continue;

      // 2. Pobierz ostatnie 50 wpisów ze strumienia dla kontekstu
      const { data: recentLogs } = await supabase
        .from('vanguard_stream')
        .select('content, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(50);

      const streamContext = (recentLogs || []).map(l => `[${l.created_at}] ${l.content}`).join('\n');

      // 3. Poproś DeepSeek o ocenę stanu intencji
      const cleanupRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            {
              role: 'system',
              content: `Jesteś Audytorem Vanguard OS. Twoim zadaniem jest ocena, które z aktywnych intencji użytkownika zostały już zrealizowane lub powinny zostać porzucone na podstawie jego aktywności w Strumieniu.
              Zwróć JSON w formacie: {"updates": [{"id": "uuid", "status": "completed" | "abandoned", "reason": "krótkie uzasadnienie"}]}`
            },
            {
              role: 'user',
              content: `AKTYWNE INTENCJE:\n${JSON.stringify(intentions)}\n\nOSTATNIA AKTYWNOŚĆ (STRUMIEŃ):\n${streamContext}`
            }
          ],
          response_format: { type: 'json_object' }
        }),
      });

      if (!cleanupRes.ok) {
        const errText = await cleanupRes.text().catch(() => 'unknown')
        throw new Error(`DeepSeek intentions-cleanup error (${cleanupRes.status}): ${errText.substring(0, 200)}`)
      }
      const auditData = await cleanupRes.json();
      const updates = JSON.parse(auditData.choices[0].message.content).updates;

      if (updates && updates.length > 0) {
        for (const update of updates) {
          await supabase
            .from('vanguard_intentions')
            .update({ 
              status: update.status,
              notes: (intentions.find(i => i.id === update.id)?.notes || '') + `\n[Auto-Cleanup]: ${update.reason}`
            })
            .eq('id', update.id);
        }
        results.push({ user_id, updated_count: updates.length });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
