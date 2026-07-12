/**
 * @function analyze-food-quality
 * @trigger HTTP POST / Frontend / manual LLM analysis
 * @role Analiza jakości żywienia za dany dzień przy użyciu LLM.
 * @reads daily_food_entries, daily_nutrition, fasting_logs, workout_sessions, strava_activities_clean
 * @writes daily_food_entries, daily_nutrition
 * @calls deepseek-chat
 * @consumer Widok podsumowania jakości jedzenia w aplikacji
 * @status active
 */
import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import { deepseekChat, parseJsonFromContent } from '../_shared/deepseek.ts'
import { getWarsawDateString as warsaw } from '../_shared/time.ts'
import { SYSTEM_PROMPT } from './prompt.ts'
import { warsawOffsetStr, buildTrainingContext, buildFoodFrequency } from './helpers.ts'
import { processMultiDay, parseMultiDayResult } from './multiDayProcessor.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId, date, dateFrom, dateTo } = body
    if (!userId) throw new Error('Missing userId')
    await resolveUserScope(req, userId)
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    // Multi-day mode
    if (dateFrom && dateTo) {
      const multiDay = await processMultiDay(supabase, userId, dateFrom, dateTo, apiKey, SYSTEM_PROMPT)
      if (!multiDay) return new Response(JSON.stringify({ error: 'Brak wpisów żywieniowych dla tego okresu' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const result = await deepseekChat({ apiKey, model: 'deepseek-chat', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: multiDay.userMessage }], maxTokens: 7000, temperature: 0.1, timeoutMs: 90000 })
      const parsed = parseMultiDayResult(result.content, multiDay.fastingDays ?? new Map(), multiDay.incompleteDays)
      return new Response(JSON.stringify({ success: true, mode: 'range', dateFrom, dateTo, ...parsed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Single-day mode
    const targetDate = date || new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const { data: fastingLog } = await supabase.from('fasting_logs').select('note').eq('user_id', userId).eq('date', targetDate).maybeSingle()
    if (fastingLog) return new Response(JSON.stringify({ success: true, mode: 'single', date: targetDate, fasting: true, day_quality_score: null, day_quality_analysis: fastingLog.note || 'Dzień świadomego postu.', items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const [todayEntriesR, historyR, workoutsR, stravaR] = await Promise.all([
      supabase.from('daily_food_entries').select('id, name, brand, meal_type, calories, protein, carbs, fat, fiber, sugar, saturated_fat, amount').eq('user_id', userId).eq('date', targetDate).order('meal_type'),
      supabase.from('daily_food_entries').select('name, calories').eq('user_id', userId).gte('date', (() => { const d = new Date(targetDate + 'T12:00:00Z'); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()).lt('date', targetDate),
      supabase.from('workout_sessions').select('workout_day, duration_minutes, msp_passed, session_rpe, exercise_logs(exercise_name, set_number, weight, reps, rir, muscle_tags)').eq('user_id', userId).eq('date', targetDate),
      supabase.from('strava_activities_clean').select('name, sport_type, distance, moving_time, hr_avg, workout_type').eq('user_id', userId).eq('is_oura', false).gte('start_date', targetDate + 'T00:00:00' + warsawOffsetStr(new Date(targetDate + 'T12:00:00Z'))).lte('start_date', targetDate + 'T23:59:59' + warsawOffsetStr(new Date(targetDate + 'T12:00:00Z'))),
    ])

    const todayEntries = todayEntriesR.data
    if (!todayEntries || todayEntries.length === 0) return new Response(JSON.stringify({ error: 'Brak wpisów żywieniowych dla tego dnia' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const workouts = workoutsR.data || []
    const stravaRuns = (stravaR.data || []).filter((a: any) => /run/i.test(a.sport_type || ''))
    const trainingContext = buildTrainingContext(workouts, stravaRuns)
    const freqLines = buildFoodFrequency(historyR.data || [])

    const byMeal: Record<string, any[]> = {}
    for (const e of todayEntries) { const m = e.meal_type || 'inne'; (byMeal[m] ??= []).push(e) }
    const mealProtein = Object.entries(byMeal).map(([meal, items]) => { const p = items.reduce((s, e) => s + (e.protein ?? 0), 0); return `  ${meal}: ${Math.round(p)}g białka (${items.length} pozycji)` }).join('\n')
    const todayLines = todayEntries.map(e => { const parts = [`- ${e.name}${e.brand ? ` (${e.brand})` : ''}`, `| ${e.meal_type}`, `| ${e.calories} kcal`, `| B:${e.protein}g W:${e.carbs}g T:${e.fat}g`]; if (e.fiber != null) parts.push(`Bl:${e.fiber}g`); if (e.sugar != null) parts.push(`Cuk:${e.sugar}g`); if (e.saturated_fat != null) parts.push(`Nas:${e.saturated_fat}g`); return parts.join(' ') }).join('\n')

    const userMessage = `DZIEŃ: ${targetDate}\n\nTRENING:\n${trainingContext}\n\nPRODUKTY:\n${todayLines}\n\nBIAŁKO:\n${mealProtein}\n\nWZORZEC 30 DNI:\n${freqLines || 'Brak'}\n\nZADANIE:\n1. Oceń każdy produkt (0-100 + reason)\n2. day_quality_analysis (2-4 zdania)\n3. day_quality_score (0-100)\n4. protein_distribution\n5. micronutrient_gaps (max 4)\n6. training_sync\n7. swap_suggestions (max 3)\n\nJSON:\n{"items":[{"name":"...","food_quality_score":0-100,"quality_reason":"..."}],"day_quality_score":0-100,"day_quality_analysis":"...","protein_distribution":[{"meal":"...","protein_g":0,"mps":true,"note":"..."}],"micronutrient_gaps":["..."],"training_sync":"...","swap_suggestions":[{"from":"...","to":"...","reason":"..."}]}`

    const result = await deepseekChat({ apiKey, model: 'deepseek-chat', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }], maxTokens: 4000, temperature: 0.1, timeoutMs: 60000 })
    const parsed: any = parseJsonFromContent(result.content)
    if (!parsed) throw new Error('Nie udało się sparsować odpowiedzi AI')
    if (!parsed?.items || !Array.isArray(parsed.items)) throw new Error('Nieprawidłowa struktura odpowiedzi AI')

    const nameToIds: Record<string, string[]> = {}
    for (const e of todayEntries) (nameToIds[e.name] ||= []).push(e.id)
    const updateResults = await Promise.all(parsed.items.filter((item: any) => nameToIds[item.name]?.length).flatMap((item: any) => nameToIds[item.name].map((id: string) => supabase.from('daily_food_entries').update({ food_quality_score: item.food_quality_score, quality_reason: item.quality_reason }).eq('id', id))))
    updateResults.forEach((r, i) => { if (r.error) console.error(`[analyze-food-quality] item update ${i} failed:`, r.error.message) })

    const { error: nutritionUpsertErr } = await supabase.from('daily_nutrition').upsert({ user_id: userId, date: targetDate, avg_food_quality: parsed.day_quality_score, food_quality_analysis: parsed.day_quality_analysis }, { onConflict: 'user_id,date' })
    if (nutritionUpsertErr) console.error('[analyze-food-quality] daily_nutrition upsert failed:', nutritionUpsertErr.message)

    return new Response(JSON.stringify({ success: true, mode: 'single', date: targetDate, items_scored: parsed.items.length, day_quality_score: parsed.day_quality_score, day_quality_analysis: parsed.day_quality_analysis, items: parsed.items, protein_distribution: parsed.protein_distribution || [], micronutrient_gaps: parsed.micronutrient_gaps || [], training_sync: parsed.training_sync || null, swap_suggestions: parsed.swap_suggestions || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error('[analyze-food-quality] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
