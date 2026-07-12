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
import { serveJson } from '../_shared/http.ts'
import { analyzeTrainingLoad } from './analysis.ts'

Deno.serve(serveJson(async (_req, ctx) => {
  const { userId, supabase } = ctx
  if (!userId) throw new Error('Missing userId')

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
  if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

  const parsed = await analyzeTrainingLoad(supabase, userId, apiKey)

  return { success: true, ...parsed }
}))
