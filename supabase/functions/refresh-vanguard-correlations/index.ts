import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id } = await req.json()

    // 1. POBIERZ HISTORIĘ (90 dni)
    const { data: history } = await supabaseClient
      .from('vanguard_daily_aggregates')
      .select('date, execution_score, sleep_hours, fragmentation_index, dopamine_load_index')
      .eq('user_id', user_id)
      .order('date', { ascending: true })

    if (!history || history.length < 20) {
      return new Response(JSON.stringify({ message: 'Zbyt mało danych do korelacji Pearsona (<20 dni)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. FUNKCJA PEARSONA
    const calculatePearson = (x: number[], y: number[]) => {
      const n = x.length
      const sumX = x.reduce((a, b) => a + b, 0)
      const sumY = y.reduce((a, b) => a + b, 0)
      const sumXY = x.reduce((a, b, i) => a + b * y[i], 0)
      const sumX2 = x.reduce((a, b) => a + b * b, 0)
      const sumY2 = y.reduce((a, b) => a + b * b, 0)
      const num = n * sumXY - sumX * sumY
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
      return den === 0 ? 0 : num / den
    }

    // 3. OBLICZ LAGI (1-2 dni)
    const signals = ['sleep_hours', 'fragmentation_index', 'dopamine_load_index']
    const correlations = []

    for (const signal of signals) {
      for (const lag of [1, 2]) {
        const y = history.slice(lag).map(d => d.execution_score)
        const x = history.slice(0, history.length - lag).map(d => d[signal] || 0)
        
        const r = calculatePearson(x, y)
        if (Math.abs(r) > 0.3) {
          correlations.push({
            user_id,
            signal_name: signal.replace('_hours', '').replace('_index', ''),
            lag_days: lag,
            r_value: r,
            sample_size: x.length
          })
        }
      }
    }

    // 4. ZAPISZ DO CACHE
    if (correlations.length > 0) {
      const { error } = await supabaseClient
        .from('vanguard_correlations')
        .upsert(correlations, { onConflict: 'user_id,signal_name,lag_days' })
      
      if (error) throw error
    }

    return new Response(JSON.stringify({ success: true, count: correlations.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
