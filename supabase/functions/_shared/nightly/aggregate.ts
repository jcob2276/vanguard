import { VanguardCore, computeSignals } from '../vanguardCore.ts'
import { safeExecute } from '../supabase.ts'
import { getWarsawDayBoundaries } from '../time.ts'

export const runSaveDailyAggregate = async (
  supabase: any,
  userId: string,
  today: string
): Promise<{ success: boolean; state: string; identity_score: number }> => {
  // Pobierz dane z aktywnych źródeł (Oura, Wins, Nutrition, Last Workout, Strava)
  const [oura, wins, nutrition, lastWorkout, stravaRaw] = await Promise.all([
    safeExecute(supabase.from('oura_daily_summary').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
    safeExecute(supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
    safeExecute(supabase.from('daily_nutrition').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
    safeExecute(supabase.from('workout_sessions').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle()),
    // Strava: aktywności z widoku clean dla danego dnia (Warsaw timezone, DST-safe)
    (() => {
      const { start: dayStart, end: dayEnd } = getWarsawDayBoundaries(today);
      return safeExecute(supabase.from('strava_activities_clean')
        .select('name,sport_type,start_date,elapsed_time,moving_time,distance,hr_avg,hr_max,total_elevation_gain,suffer_score')
        .eq('user_id', userId)
        .gte('start_date', dayStart)
        .lt('start_date', dayEnd)
        .order('start_date', { ascending: true }));
    })(),
  ])

  const lastTrainingDate = lastWorkout?.date || null

  // --- Format Strava activities ---
  function fmtTime(seconds: number): string {
    if (!seconds) return '0:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function fmtPace(movingTime: number, distanceM: number): string {
    if (!movingTime || !distanceM) return '—'
    const secPerKm = movingTime / (distanceM / 1000)
    const m = Math.floor(secPerKm / 60)
    const s = Math.round(secPerKm % 60)
    return `${m}:${String(s).padStart(2, '0')} /km`
  }

  const stravaActivities = ((stravaRaw as Record<string, unknown>[]) || []).map((a: Record<string, unknown>) => {
    const startWarsawHour = new Date(a.start_date as string).toLocaleTimeString('pl-PL', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit'
    })
    const distanceM = a.distance != null ? Number(a.distance) : null
    const elapsedTime = a.elapsed_time != null ? Number(a.elapsed_time) : null
    const movingTime = a.moving_time != null ? Number(a.moving_time) : null
    const distKm = distanceM ? +(distanceM / 1000).toFixed(2) : null
    return {
      name:                 a.name,
      sport_type:           a.sport_type,
      start_time:           startWarsawHour,
      start_date:           a.start_date,
      distance_km:          distKm,
      elapsed_time_fmt:     elapsedTime ? fmtTime(elapsedTime) : null,
      moving_time_fmt:      movingTime  ? fmtTime(movingTime)  : null,
      pace_per_km:          movingTime && distanceM ? fmtPace(movingTime, distanceM) : '—',
      average_heartrate:    a.hr_avg ?? null,
      max_heartrate:        a.hr_max ?? null,
      total_elevation_gain: a.total_elevation_gain ?? null,
      calories:             null,
      suffer_score:         a.suffer_score ?? null,
    }
  })

  // --- Unified Signal Computation (Vanguard Core) ---
  const signals = computeSignals(
    oura,
    wins,
    { protein: nutrition?.protein || 0 },
    lastTrainingDate,
    today
  )

  // --- State and Stability Calculation via VanguardCore ---
  const core = new VanguardCore(userId, supabase)
  const bl = await core.getPersonalBaseline()
  const { state: finalState } = await core.determineState(signals, bl)

  // --- Identity Score (z-score relative do personal baseline, nie sztywne progi) ---
  // Maksymalnie 100. Każda metryka poniżej osobistej normy odejmuje punkty proporcjonalnie do odchylenia.
  let identityScore = 100

  // Power List result
  if (wins?.result === 'P') identityScore -= 30
  if (!wins) identityScore -= 10

  // Protein: kara gdy <0.5 sigma poniżej baseline (adaptacyjne)
  if (!bl.calibrating && bl.means.execution != null) {
    const proteinBaseline = (bl.means as Record<string, unknown>)?.protein as number ?? 140
    const zProtein = signals.protein_grams > 0 ? (signals.protein_grams - proteinBaseline) / Math.max(proteinBaseline * 0.15, 20) : -2
    if (zProtein < -0.5) identityScore -= Math.round(Math.min(20, (Math.abs(zProtein) - 0.5) * 10))
  } else {
    // calibrating — fallback do sztywnego progu
    if ((nutrition as Record<string, unknown>)?.protein as number < 140) identityScore -= 15
  }

  // Sleep: kara gdy poniżej personal baseline (nie sztywne 6.5h)
  if (oura?.total_sleep_hours != null) {
    if (!bl.calibrating) {
      const zSleep = core._zScore(oura.total_sleep_hours, bl.means.sleep, bl.stdDevs.sleep)
      if (zSleep < -1.0) identityScore -= 15
      else if (zSleep < -0.5) identityScore -= 7
    } else {
      if (oura.total_sleep_hours < 6.5) identityScore -= 15
    }
  }

  // Readiness: kara przy obiektywnie niskim readiness (bezwzględne minimum <60)
  if (oura?.readiness_score != null && oura.readiness_score < 60) identityScore -= 10

  identityScore = Math.max(0, identityScore)

  const aggregate = {
    user_id: userId,
    date: today,
    execution_score: signals.execution_ratio,
    identity_score: identityScore,
    power_list_result: wins?.result || null,
    readiness_score: signals.readiness,
    sleep_hours: signals.sleep,
    hrv_avg: signals.hrv,
    rhr_avg: signals.rhr,
    screen_time_min: null,
    dopamine_load_index: null,
    fragmentation_index: null,
    final_state: finalState,
    state_confidence: oura ? 0.6 : 0.3,
    strava_activities_json: stravaActivities.length > 0 ? stravaActivities : null,
  }

  await safeExecute(
    supabase
      .from('vanguard_daily_aggregates')
      .upsert(aggregate, { onConflict: 'user_id,date' })
  )

  return { success: true, state: finalState, identity_score: identityScore }
}
