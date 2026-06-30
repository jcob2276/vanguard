import type { SeriesPoint } from './correlationEngine.ts'
import { estimateCaffeineMg } from './caffeineEstimate.ts'
import { getWarsawDateString } from './time.ts'

function warsawHour(iso: string): number {
  return parseInt(
    new Date(iso).toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }),
    10
  )
}

function emptySeries(): Record<string, SeriesPoint[]> {
  return {
    strain: [], recovery: [], fueling: [], cardio: [], strength: [], cns_load: [], leg_load: [], mental_load: [],
    illness_score: [], hrv: [], rhr: [], readiness: [], sleep_h: [], sleep_score: [],
    sleep_efficiency: [], sleep_latency: [], deep_sleep_h: [], rem_sleep_h: [], light_sleep_h: [],
    sleep_hr: [], sleep_hrv: [], sleep_lowest_hr: [], restless_periods: [], temp_deviation: [],
    spo2: [], vo2max: [], stress_high_min: [], met_avg: [], sedentary_min: [], bedtime_hour: [],
    calories: [], protein: [], carbs: [], fat: [], sugar: [], fiber: [], insulin_load: [], food_quality: [],
    steps: [], caffeine_mg: [], caffeine_late_mg: [], last_coffee_hour: [], last_meal_hour: [], calories_late: [],
    workout_hr_peak: [], workout_hr_avg: [], workout_strain: [],
    run_hr: [], run_rpe: [], run_cadence: [], run_suffer: [], run_distance_km: [],
    mood_score: [], daily_rpe: [], plan_done_pct: [], day_score: [], phone_drift: [],
    execution_score: [], identity_score: [], dopamine_load_index: [],
    screen_time_min: [], fragmentation_index: [], productivity_ratio: [], phone_active_h: [],
    friction_count: [], avoidance_count: [], procrastination_count: [],
    alcohol_units: [], travel_day: [], illness_day: [], stress_manual: [],
    creatine_taken: [], omega3_taken: [], lions_mane_taken: [], d3_taken: [],
    habit_count: [], weight_kg: [],
  }
}

export interface SeriesBuildInput {
  todayWarsaw: string
  strainRows: Record<string, unknown>[]
  ouraRows: Record<string, unknown>[]
  ouraEnhRows: Record<string, unknown>[]
  nutrRows: Record<string, unknown>[]
  aggregateRows: Record<string, unknown>[]
  frictionRows: { occurred_at: string | null; friction_type: string | null }[]
  foodRows: { date: string; name: string | null; logged_at: string | null; calories: number | null }[]
  workoutRows: { workout_day: string | null; hr_avg_bpm: number | null; hr_peak_bpm: number | null; hr_strain_score: number | null }[]
  winsRows: Record<string, unknown>[]
  reconRows: { date: string; day_score: number | null; phone_drift_morning: boolean | null }[]
  behaviorRows: { date: string; behavior_key: string; value: number | null }[]
  supplementRows: { date: string; slug: string }[]
  stravaRows: { day: string; hr_avg: number | null; perceived_exertion: number | null; cadence_spm: number | null; suffer_score: number | null; distance: number | null }[]
  awRows: { date: string; productivity_ratio: number | null; phone_active_seconds: number | null }[]
  habitRows: Record<string, unknown>[]
  bodyRows: { date: string; weight: number | null }[]
}

export function buildMetricSeries(input: SeriesBuildInput): Record<string, SeriesPoint[]> {
  const series = emptySeries()

  for (const r of input.strainRows) {
    const date = String(r.date)
    if (r.strain_score != null) series.strain.push({ day: date, value: Number(r.strain_score) })
    if (r.recovery_score != null) series.recovery.push({ day: date, value: Number(r.recovery_score) })
    if (r.fueling_score != null) series.fueling.push({ day: date, value: Number(r.fueling_score) })
    if (r.cardio_load != null) series.cardio.push({ day: date, value: Number(r.cardio_load) })
    if (r.strength_load != null) series.strength.push({ day: date, value: Number(r.strength_load) })
    if (r.cns_load != null) series.cns_load.push({ day: date, value: Number(r.cns_load) })
    if (r.leg_load != null) series.leg_load.push({ day: date, value: Number(r.leg_load) })
    if (r.mental_load_score != null) series.mental_load.push({ day: date, value: Number(r.mental_load_score) })
    if (r.illness_score != null) series.illness_score.push({ day: date, value: Number(r.illness_score) })
    const steps = (r.components as Record<string, unknown>)?.steps
    if (steps != null) series.steps.push({ day: date, value: Number(steps) })
  }

  for (const r of input.ouraRows) {
    const date = String(r.date)
    if (r.hrv_avg != null) series.hrv.push({ day: date, value: Number(r.hrv_avg) })
    if (r.rhr_avg != null) series.rhr.push({ day: date, value: Number(r.rhr_avg) })
    if (r.total_sleep_hours != null) series.sleep_h.push({ day: date, value: Number(r.total_sleep_hours) })
    if (r.sleep_score != null) series.sleep_score.push({ day: date, value: Number(r.sleep_score) })
    if (r.readiness_score != null) series.readiness.push({ day: date, value: Number(r.readiness_score) })
  }

  for (const r of input.ouraEnhRows) {
    const date = String(r.date)
    const push = (key: keyof typeof series, val: unknown) => {
      if (val != null) series[key].push({ day: date, value: Number(val) })
    }
    push('sleep_efficiency', r.sleep_efficiency)
    push('sleep_latency', r.sleep_latency_minutes)
    push('deep_sleep_h', r.deep_sleep_hours)
    push('rem_sleep_h', r.rem_sleep_hours)
    push('light_sleep_h', r.light_sleep_hours)
    push('sleep_hr', r.sleep_average_heart_rate)
    push('sleep_hrv', r.sleep_average_hrv)
    push('sleep_lowest_hr', r.sleep_lowest_heart_rate)
    push('restless_periods', r.restless_periods)
    push('temp_deviation', r.temperature_deviation)
    push('spo2', r.spo2_percentage)
    push('vo2max', r.vo2_max)
    push('stress_high_min', r.stress_high_minutes)
    push('met_avg', r.average_met_minutes)
    push('sedentary_min', r.sedentary_minutes)
    if (r.bedtime_start) {
      const h = warsawHour(String(r.bedtime_start))
      series.bedtime_hour.push({ day: date, value: h })
    }
  }

  for (const r of input.nutrRows) {
    const date = String(r.date)
    if (r.calories != null) series.calories.push({ day: date, value: Number(r.calories) })
    if (r.protein != null) series.protein.push({ day: date, value: Number(r.protein) })
    if (r.carbs != null) series.carbs.push({ day: date, value: Number(r.carbs) })
    if (r.fat != null) series.fat.push({ day: date, value: Number(r.fat) })
    if (r.sugar != null) series.sugar.push({ day: date, value: Number(r.sugar) })
    if (r.fiber != null) series.fiber.push({ day: date, value: Number(r.fiber) })
    if (r.insulin_load != null) series.insulin_load.push({ day: date, value: Number(r.insulin_load) })
    if (r.avg_food_quality != null) series.food_quality.push({ day: date, value: Number(r.avg_food_quality) })
  }

  for (const r of input.aggregateRows) {
    const date = String(r.date)
    if (r.execution_score != null) series.execution_score.push({ day: date, value: Number(r.execution_score) })
    if (r.identity_score != null) series.identity_score.push({ day: date, value: Number(r.identity_score) })
    if (r.dopamine_load_index != null) series.dopamine_load_index.push({ day: date, value: Number(r.dopamine_load_index) })
    if (r.screen_time_min != null) series.screen_time_min.push({ day: date, value: Number(r.screen_time_min) })
    if (r.fragmentation_index != null) series.fragmentation_index.push({ day: date, value: Number(r.fragmentation_index) })
  }

  // Food timing + caffeine
  const foodByDay: Record<string, typeof input.foodRows> = {}
  for (const row of input.foodRows) {
    (foodByDay[row.date] ||= []).push(row)
  }
  for (const [day, entries] of Object.entries(foodByDay)) {
    let caffeineMg = 0, caffeineLateMg = 0, caloriesLate = 0
    let lastMealHour: number | null = null, lastCoffeeHour: number | null = null
    for (const e of entries) {
      const mg = estimateCaffeineMg(e.name ?? '')
      if (e.logged_at) {
        const hour = warsawHour(e.logged_at)
        if (hour > (lastMealHour ?? -1)) lastMealHour = hour
        if (mg > 0) {
          caffeineMg += mg
          if (hour >= 15) caffeineLateMg += mg
          if (hour > (lastCoffeeHour ?? -1)) lastCoffeeHour = hour
        }
        if (hour >= 20) caloriesLate += Number(e.calories ?? 0)
      } else if (mg > 0) caffeineMg += mg
    }
    if (caffeineMg > 0) series.caffeine_mg.push({ day, value: caffeineMg })
    if (caffeineLateMg > 0) series.caffeine_late_mg.push({ day, value: caffeineLateMg })
    if (lastCoffeeHour != null) series.last_coffee_hour.push({ day, value: lastCoffeeHour })
    if (lastMealHour != null) series.last_meal_hour.push({ day, value: lastMealHour })
    if (caloriesLate > 0) series.calories_late.push({ day, value: caloriesLate })
  }

  // Workouts
  const workoutByDay: Record<string, { peaks: number[]; avgs: number[]; strains: number[] }> = {}
  for (const w of input.workoutRows) {
    const day = w.workout_day
    if (!day) continue
    (workoutByDay[day] ||= { peaks: [], avgs: [], strains: [] })
    if (w.hr_peak_bpm != null) workoutByDay[day].peaks.push(Number(w.hr_peak_bpm))
    if (w.hr_avg_bpm != null) workoutByDay[day].avgs.push(Number(w.hr_avg_bpm))
    if (w.hr_strain_score != null) workoutByDay[day].strains.push(Number(w.hr_strain_score))
  }
  for (const [day, agg] of Object.entries(workoutByDay)) {
    if (agg.peaks.length) series.workout_hr_peak.push({ day, value: Math.max(...agg.peaks) })
    if (agg.avgs.length) series.workout_hr_avg.push({ day, value: agg.avgs.reduce((a, b) => a + b, 0) / agg.avgs.length })
    if (agg.strains.length) series.workout_strain.push({ day, value: Math.max(...agg.strains) })
  }

  // Strava runs
  for (const s of input.stravaRows) {
    if (s.hr_avg != null) series.run_hr.push({ day: s.day, value: Number(s.hr_avg) })
    if (s.perceived_exertion != null) series.run_rpe.push({ day: s.day, value: Number(s.perceived_exertion) })
    if (s.cadence_spm != null) series.run_cadence.push({ day: s.day, value: Number(s.cadence_spm) })
    if (s.suffer_score != null) series.run_suffer.push({ day: s.day, value: Number(s.suffer_score) })
    if (s.distance != null) series.run_distance_km.push({ day: s.day, value: Number(s.distance) / 1000 })
  }

  // Wins / plan / recon
  for (const w of input.winsRows) {
    const date = String(w.date)
    if (w.mood_score != null) series.mood_score.push({ day: date, value: Number(w.mood_score) })
    if (w.daily_rpe != null) series.daily_rpe.push({ day: date, value: Number(w.daily_rpe) })
    let total = 0, done = 0
    for (let i = 1; i <= 5; i++) {
      if (w[`task_${i}`]) { total++; if (w[`done_${i}`]) done++ }
    }
    if (total > 0) series.plan_done_pct.push({ day: date, value: Math.round((done / total) * 100) })
  }

  for (const r of input.reconRows) {
    if (r.day_score != null) series.day_score.push({ day: r.date, value: Number(r.day_score) })
    if (r.phone_drift_morning != null) series.phone_drift.push({ day: r.date, value: r.phone_drift_morning ? 1 : 0 })
  }

  // Behavior log pivot
  for (const row of input.behaviorRows) {
    const key = row.behavior_key.toLowerCase()
    const val = row.value ?? 1
    if (key.includes('alcohol') || key === 'alkohol') series.alcohol_units.push({ day: row.date, value: Number(val) })
    else if (key === 'travel' || key === 'podroz') series.travel_day.push({ day: row.date, value: 1 })
    else if (key.includes('illness') || key.includes('choroba')) series.illness_day.push({ day: row.date, value: Number(val) })
    else if (key.includes('stress') || key === 'stres') series.stress_manual.push({ day: row.date, value: Number(val) })
  }

  // Supplements (daily bool 0/1)
  const suppByDay: Record<string, Set<string>> = {}
  for (const row of input.supplementRows) {
    (suppByDay[row.date] ||= new Set()).add(row.slug)
  }
  for (const [day, slugs] of Object.entries(suppByDay)) {
    if (slugs.has('kreatyna') || slugs.has('creatine')) series.creatine_taken.push({ day, value: 1 })
    if (slugs.has('omega3') || slugs.has('omega-3')) series.omega3_taken.push({ day, value: 1 })
    if (slugs.has('lionsmane') || slugs.has('lions_mane')) series.lions_mane_taken.push({ day, value: 1 })
    if (slugs.has('d3k2') || slugs.has('d3')) series.d3_taken.push({ day, value: 1 })
  }

  // AW
  for (const a of input.awRows) {
    if (a.productivity_ratio != null) series.productivity_ratio.push({ day: a.date, value: Number(a.productivity_ratio) })
    if (a.phone_active_seconds != null) series.phone_active_h.push({ day: a.date, value: Number(a.phone_active_seconds) / 3600 })
  }

  // Habits completed per day
  const HABIT_KEYS = ['bar_hang', 'child_pose', 'chin_tucks', 'couch_stretch', 'glute_bridge', 'protein_170g']
  for (const h of input.habitRows) {
    const date = String(h.date ?? '')
    if (!date) continue
    let count = 0
    for (const key of HABIT_KEYS) if (h[key]) count++
    if (count > 0) series.habit_count.push({ day: date, value: count })
  }

  // Body weight
  for (const b of input.bodyRows) {
    if (b.weight != null) series.weight_kg.push({ day: b.date, value: Number(b.weight) })
  }

  // Friction backfill (90d)
  const dailyFriction: Record<string, { total: number; avoidance: number; procrastination: number }> = {}
  for (let i = 0; i < 90; i++) {
    const d = new Date(input.todayWarsaw + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    dailyFriction[dateStr] = { total: 0, avoidance: 0, procrastination: 0 }
  }
  for (const row of input.frictionRows) {
    if (!row.occurred_at) continue
    const dateStr = getWarsawDateString(new Date(row.occurred_at))
    if (dailyFriction[dateStr]) {
      dailyFriction[dateStr].total++
      if (row.friction_type === 'avoidance') dailyFriction[dateStr].avoidance++
      if (row.friction_type === 'procrastination') dailyFriction[dateStr].procrastination++
    }
  }
  for (const [day, counts] of Object.entries(dailyFriction)) {
    series.friction_count.push({ day, value: counts.total })
    series.avoidance_count.push({ day, value: counts.avoidance })
    series.procrastination_count.push({ day, value: counts.procrastination })
  }

  return series
}

export function aggregateStravaRuns(
  rows: Record<string, unknown>[],
  todayWarsaw: string,
  start90: string
): SeriesBuildInput['stravaRows'] {
  const byDay: Record<string, { hr: number[]; rpe: number[]; cadence: number[]; suffer: number[]; dist: number[] }> = {}
  for (const r of rows) {
    const start = r.start_date as string | null
    if (!start) continue
    const day = getWarsawDateString(new Date(start))
    if (day < start90 || day > todayWarsaw) continue
    if (r.is_oura === true) continue
    const sport = String(r.sport_type ?? '').toLowerCase()
    if (!sport.includes('run')) continue
    (byDay[day] ||= { hr: [], rpe: [], cadence: [], suffer: [], dist: [] })
    if (r.hr_avg != null) byDay[day].hr.push(Number(r.hr_avg))
    if (r.perceived_exertion != null) byDay[day].rpe.push(Number(r.perceived_exertion))
    if (r.cadence_spm != null) byDay[day].cadence.push(Number(r.cadence_spm))
    if (r.suffer_score != null) byDay[day].suffer.push(Number(r.suffer_score))
    if (r.distance != null) byDay[day].dist.push(Number(r.distance))
  }
  return Object.entries(byDay).map(([day, v]) => ({
    day,
    hr_avg: v.hr.length ? v.hr.reduce((a, b) => a + b, 0) / v.hr.length : null,
    perceived_exertion: v.rpe.length ? Math.max(...v.rpe) : null,
    cadence_spm: v.cadence.length ? v.cadence.reduce((a, b) => a + b, 0) / v.cadence.length : null,
    suffer_score: v.suffer.length ? Math.max(...v.suffer) : null,
    distance: v.dist.length ? v.dist.reduce((a, b) => a + b, 0) : null,
  }))
}
