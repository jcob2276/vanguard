/**
 * @function analyze-training-load
 * @trigger HTTP POST / Frontend / manual LLM analysis
 * @role Analiza obciążenia treningowego na podstawie sesji i planów.
 * @reads daily_strain, workout_sessions, strava_activities_clean, training_plan_workouts, oura_daily_summary
 * @writes —
 * @calls deepseek-chat (w analysis.ts)
 * @consumer Sekcja treningowa w aplikacji
 * @status active
 */
import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import { analyzeTrainingLoad } from './analysis.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId } = body
    if (!userId) throw new Error('Missing userId')
    await resolveUserScope(req, userId)

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    const parsed = await analyzeTrainingLoad(supabase, userId, apiKey)

    return new Response(
      JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[analyze-training-load] error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
