import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import { deepseekChat } from '../_shared/deepseek.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function epley(weight: number, reps: number): number | null {
  if (!weight || !reps || reps <= 0) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

function avg(arr: number[]): number | null {
  const valid = arr.filter(v => v != null && !isNaN(v))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function fmtPace(sec: number, distM: number): string {
  if (!sec || !distM) return '—'
  const spk = sec / (distM / 1000)
  return `${Math.floor(spk / 60)}:${String(Math.round(spk % 60)).padStart(2, '0')} /km`
}

function pct(curr: number | null, base: number | null): string {
  if (curr == null || base == null || base === 0) return ''
  const p = ((curr - base) / base) * 100
  return ` (${p > 0 ? '+' : ''}${p.toFixed(0)}%)`
}

function fmt(v: number | null, dec = 1, suffix = ''): string {
  return v != null ? `${v.toFixed(dec)}${suffix}` : '—'
}

const ACTIVITY_KW = /saun|rower|spacer|stretch|masaż|foam|mobility/i
const SAUNA_KW = /saun/i
const PATTERN_RULES: Array<{ key: string; label: string; re: RegExp; priority: number }> = [
  { key: 'calf', label: 'łydka / Achilles', re: /łyd|lydk|calf|wspię|wspiec|palce|soleus|achill/i, priority: 10 },
  { key: 'tibialis', label: 'tibialis / stopa', re: /tibialis|piszczel|stop|foot|toe|palc/i, priority: 9 },
  { key: 'single_leg', label: 'single-leg stabilizacja', re: /single.?leg|bułgar|bulgar|wykrok|lunge|step.?up|split squat|jednonóż|jednonoz/i, priority: 10 },
  { key: 'hinge', label: 'hinge / posterior chain', re: /martwy|deadlift|rdl|hip thrust|good morning|pull through|hinge|dwugłow|hamstring/i, priority: 9 },
  { key: 'squat', label: 'squat / kolano', re: /przysiad|squat|leg press|hack|front squat|goblet/i, priority: 7 },
  { key: 'pull', label: 'pull / plecy', re: /wios|row|podciąg|podciag|pull.?up|ściąg|sciag|lat|face pull|rear delt/i, priority: 6 },
  { key: 'push', label: 'push / klatka-barki', re: /wycisk|bench|ohp|press|dip|pomp|push.?up/i, priority: 6 },
  { key: 'core', label: 'core / antyrotacja', re: /plank|dead bug|pallof|core|brzuch|farmer|carry|side plank/i, priority: 8 },
]

const LEG_PATTERN_KEYS = new Set(['calf', 'tibialis', 'single_leg', 'hinge', 'squat'])
const EXERCISE_LIBRARY: Record<string, Array<{ name: string; setsReps: string; intensity: number | null; fallbackLoad: string; goal: string }>> = {
  calf: [
    { name: 'Wspięcia na palce stojąc', setsReps: '4×8-10', intensity: 0.78, fallbackLoad: 'RPE 7-8', goal: 'Achilles/łydka: ciężki bodziec siłowo-ścięgnisty' },
    { name: 'Wspięcia siedząc', setsReps: '3×12-15', intensity: null, fallbackLoad: 'RPE 8', goal: 'soleus pod ekonomię biegu' },
  ],
  tibialis: [
    { name: 'Tibialis raise', setsReps: '3×15-20', intensity: null, fallbackLoad: 'RPE 7', goal: 'piszczelowy/stopa: balans dla łydki' },
  ],
  single_leg: [
    { name: 'Single-leg RDL', setsReps: '3×8 na nogę', intensity: null, fallbackLoad: 'BW+lekki ciężar, RPE 7', goal: 'miednica, hamstring, kontrola kolana' },
    { name: 'Bulgarian split squat', setsReps: '3×8 na nogę', intensity: null, fallbackLoad: 'RPE 7-8', goal: 'single-leg siła + hipertrofia bez dużego axial load' },
  ],
  hinge: [
    { name: 'Martwy ciąg', setsReps: '3×5', intensity: 0.84, fallbackLoad: 'RPE 7-8', goal: 'posterior chain i siła biodra' },
    { name: 'RDL', setsReps: '3×6-8', intensity: 0.72, fallbackLoad: 'RPE 7', goal: 'hamstring hipertrofia + kontrola ekscentryczna' },
  ],
  squat: [
    { name: 'Przysiad', setsReps: '3×5', intensity: 0.80, fallbackLoad: 'RPE 7', goal: 'quad/glute strength bez zajechania nóg' },
  ],
  pull: [
    { name: 'Wiosłowanie sztangą', setsReps: '4×8', intensity: 0.72, fallbackLoad: 'RPE 8', goal: 'plecy, postawa, równowaga dla pressingu' },
    { name: 'Podciąganie', setsReps: '4×6-8', intensity: null, fallbackLoad: 'BW lub BW+dodatkowy ciężar RPE 8', goal: 'pionowy pull i sylwetka' },
  ],
  push: [
    { name: 'Wyciskanie płaskie', setsReps: '3×5', intensity: 0.84, fallbackLoad: 'RPE 7-8', goal: 'siła góry bez nadmiernej objętości' },
    { name: 'Dips', setsReps: '3×8', intensity: null, fallbackLoad: 'BW/BW+ciężar RPE 8', goal: 'klatka/triceps, bodziec sylwetkowy' },
  ],
  core: [
    { name: 'Pallof press', setsReps: '3×10/strona', intensity: null, fallbackLoad: 'RPE 7', goal: 'antyrotacja pod kontrolę miednicy' },
    { name: 'Plank boczny', setsReps: '3×30-45s/strona', intensity: null, fallbackLoad: 'BW', goal: 'core boczny i stabilizacja' },
  ],
}

// Strava run workout_type codes: 0=default, 1=race, 2=long_run, 3=workout (4/6/7 don't exist for runs)
function classifyRun(a: any): string {
  const wt = Number(a.workout_type)
  if (wt === 1) return 'Wyścig'
  if (wt === 2) return 'Długi bieg'
  if (wt === 3) return 'Trening/Interwały'
  const name = (a.name || '').toLowerCase()
  if (/długi|long/i.test(name)) return 'Długi bieg'
  if (/tempo/i.test(name)) return 'Tempo'
  if (/interw|interval/i.test(name)) return 'Interwały'
  if (/z2|regenera|easy|spokojn|aerob|tlenow/i.test(name)) return 'Z2/Easy'
  if (/tr3|trening 3|workout/i.test(name)) return 'Trening/Interwały'
  return 'Bieg'
}

function fmtGcZones(zones: any): string {
  if (!Array.isArray(zones) || !zones.length) return ''
  return zones.map((z: any, i: number) => {
    const mins = z.secsInZone != null ? Math.round(z.secsInZone / 60) : null
    return mins != null && mins > 0 ? `Z${i + 1}:${mins}min` : null
  }).filter(Boolean).join(' ')
}

function weekOf(date: string, now: Date, warsaw: (d: Date) => string): number {
  // returns 0 = this week (last 7 days), 1 = prev week, 2 = 2 weeks ago, 3 = 3 weeks ago
  const today = warsaw(now)
  const daysAgo = Math.floor((new Date(today + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 864e5)
  if (daysAgo < 7) return 0
  if (daysAgo < 14) return 1
  if (daysAgo < 21) return 2
  return 3
}

function isoDow(date: string): number {
  const day = new Date(date + 'T12:00:00Z').getUTCDay()
  return day === 0 ? 7 : day
}

const DOW_PL: Record<number, string> = {
  1: 'poniedziałek',
  2: 'wtorek',
  3: 'środa',
  4: 'czwartek',
  5: 'piątek',
  6: 'sobota',
  7: 'niedziela',
}

function dayDiff(from: string | null, to: string): number | null {
  if (!from) return null
  return Math.floor((new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime()) / 864e5)
}

function exercisePatterns(name: string, tags: string[] = []): string[] {
  const hay = `${name || ''} ${tags.join(' ')}`.toLowerCase()
  return PATTERN_RULES.filter(r => r.re.test(hay)).map(r => r.key)
}

function classifyFatigue(patterns: string[], rir: number | null, sets: number): 'low' | 'medium' | 'high' {
  const leg = patterns.some(p => LEG_PATTERN_KEYS.has(p))
  if (leg && (sets >= 6 || (rir != null && rir <= 1.5))) return 'high'
  if (leg || sets >= 4 || (rir != null && rir <= 2)) return 'medium'
  return 'low'
}

function roundTo2_5(v: number): number {
  return Math.round(v / 2.5) * 2.5
}

function loadHint(name: string, intensity: number | null, allTimeE1rm: Record<string, number>, fallback: string): string {
  if (intensity == null) return fallback
  const exact = allTimeE1rm[name]
  const fuzzyEntry = Object.entries(allTimeE1rm).find(([k]) => k.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase()))
  const e1rm = exact ?? fuzzyEntry?.[1]
  return e1rm ? `${roundTo2_5(e1rm * intensity)}kg` : fallback
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId } = body
    if (!userId) throw new Error('Missing userId')
    await resolveUserScope(req, userId)

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    // ── Date windows (28 dni = 4 pełne tygodnie) ─────────────────────────────
    const now = new Date()
    const warsaw = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    const today = warsaw(now)
    const todayDow = isoDow(today)
    const todayDowLabel = DOW_PL[todayDow]
    const weekProgress = todayDow / 7
    const earlyWeek = todayDow <= 2
    const midWeek = todayDow >= 3 && todayDow <= 4
    const w0Start = warsaw(new Date(now.getTime() - 6 * 864e5))   // ten tydzień (7 dni)
    const w4Start = warsaw(new Date(now.getTime() - 27 * 864e5))  // 4 tygodnie wstecz

    // ── Parallel data fetch ───────────────────────────────────────────────────
    const [strainR, workoutsR, stravaR, ouraR, planR] = await Promise.all([
      supabase
        .from('daily_strain')
        .select('date,strain_score,cardio_load,strength_load')
        .eq('user_id', userId).gte('date', w4Start).lte('date', today).order('date'),
      supabase
        .from('workout_sessions')
        .select('id,date,workout_day,session_notes,msp_passed,duration_minutes,exercise_logs(exercise_name,set_number,weight,reps,rir,rpe,muscle_tags,is_pws_or_msp)')
        .eq('user_id', userId).gte('date', w4Start).lte('date', today).order('date'),
      supabase
        .from('strava_activities_clean')
        .select('start_date,name,sport_type,distance,moving_time,hr_avg,hr_max,perceived_exertion,has_pr,workout_type,gc_hr_zones,gc_weather,gc_laps,gc_training_effect_aerobic,gc_training_effect_anaerobic,gc_vo2max,gc_enriched_at')
        .eq('user_id', userId).eq('is_oura', false)
        .gte('start_date', w4Start + 'T00:00:00').lte('start_date', today + 'T23:59:59').order('start_date'),
      supabase
        .from('oura_daily_summary')
        .select('date,hrv_avg,rhr_avg,readiness_score,total_sleep_hours')
        .eq('user_id', userId).gte('date', w4Start).lte('date', today).order('date'),
      supabase
        .from('training_plan_workouts')
        .select('planned_date,workout_type,workout_name,target_distance_km,target_duration_min,target_pace_min_km,target_hr_max,week_number,goal,description')
        .eq('user_id', userId)
        .gte('planned_date', w0Start)
        .lte('planned_date', warsaw(new Date(now.getTime() + 7 * 864e5)))
        .order('planned_date'),
    ])

    const strainAll = strainR.data || []
    const workoutsAll = workoutsR.data || []
    const stravaAll = stravaR.data || []
    const ouraAll = ouraR.data || []
    const planContext = planR.data || []

    // ── Per-week slices (w0=this week, w1=prev, w2, w3=oldest) ───────────────
    const wn = (row: any, dateKey = 'date') => weekOf(row[dateKey] || warsaw(new Date(row.start_date)), now, warsaw)
    const byWeek = <T,>(arr: T[], key = 'date') => {
      const r: T[][] = [[], [], [], []]
      for (const x of arr) {
        const w = wn(x as any, key)
        if (w >= 0 && w <= 3) r[w].push(x)
      }
      return r  // r[0] = this week, r[1] = prev, ...
    }

    const stravaByWeek = (() => {
      const r: any[][] = [[], [], [], []]
      for (const a of stravaAll) {
        const w = weekOf(warsaw(new Date(a.start_date)), now, warsaw)
        if (w >= 0 && w <= 3) r[w].push(a)
      }
      return r
    })()

    const workoutsByWeek = byWeek(workoutsAll)
    const strainByWeek = byWeek(strainAll)
    const ouraByWeek = byWeek(ouraAll)

    // ── HRmax estimation (from 28-day data) ───────────────────────────────────
    const allHrMax = stravaAll.map((a: any) => Number(a.hr_max)).filter(v => v > 100)
    const hrMax = allHrMax.length ? Math.max(...allHrMax) : null
    const z2Ceiling = hrMax ? Math.round(hrMax * 0.76) : null   // ~76% HRmax = Z2 top
    const thresholdHr = hrMax ? Math.round(hrMax * 0.88) : null // ~88% = threshold

    // ── Weekly summaries (all 4 weeks) ────────────────────────────────────────
    const wkSummary = (wIdx: number) => {
      const runs = stravaByWeek[wIdx].filter((a: any) => /run/i.test(a.sport_type || ''))
      const allLogs = workoutsByWeek[wIdx].flatMap((w: any) => w.exercise_logs || [])
      const sets = allLogs.filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || '')).length
      const km = runs.reduce((s: number, a: any) => s + (a.distance || 0) / 1000, 0)
      const strainAvg = avg(strainByWeek[wIdx].map((r: any) => Number(r.strain_score)).filter(Boolean))
      const recovAvg = avg(ouraByWeek[wIdx].map((r: any) => Number(r.readiness_score)).filter(Boolean))
      const hrvAvg = avg(ouraByWeek[wIdx].map((r: any) => Number(r.hrv_avg)).filter(Boolean))
      const sleepAvg = avg(ouraByWeek[wIdx].map((r: any) => Number(r.total_sleep_hours)).filter(Boolean))
      const saunaCount = workoutsByWeek[wIdx].filter((w: any) =>
        (w.exercise_logs || []).some((l: any) => SAUNA_KW.test(l.exercise_name || ''))
      ).length
      const hasLongRun = runs.some((a: any) => classifyRun(a) === 'Długi bieg')
      const maxRunKm = runs.length ? Math.max(...runs.map((a: any) => (a.distance || 0) / 1000)) : 0
      return { sets, km: +km.toFixed(1), strainAvg, recovAvg, hrvAvg, sleepAvg, saunaCount, hasLongRun, maxRunKm: +maxRunKm.toFixed(1), runCount: runs.length }
    }

    const [w0, w1, w2, w3] = [0, 1, 2, 3].map(wkSummary)
    const baseRunKm = avg([w1.km, w2.km, w3.km]) ?? 0
    const baseSets = avg([w1.sets, w2.sets, w3.sets]) ?? 0
    const baseStrain = avg([w1.strainAvg, w2.strainAvg, w3.strainAvg].filter(Boolean) as number[]) ?? null
    const expectedRunKmToDate = +(baseRunKm * weekProgress).toFixed(1)
    const expectedSetsToDate = Math.round(baseSets * weekProgress)
    const expectedStrainToDate = baseStrain != null ? +(baseStrain * weekProgress).toFixed(1) : null

    // ── ACWR + Monotony (Gabbett 2016 / Foster 1998) ──────────────────────────
    // ACWR: acute (7-day) / chronic (28-day) strain. Sweet spot 0.8–1.3; >1.5 = injury risk.
    // Monotony: weekMean / weekSD. >2.0 = too little variation, higher strain/illness risk.
    const acuteStrains = strainAll
      .filter((r: any) => r.date >= w0Start && r.strain_score != null)
      .map((r: any) => Number(r.strain_score))
    const chronicStrains = strainAll
      .filter((r: any) => r.strain_score != null)
      .map((r: any) => Number(r.strain_score))
    const acuteLoad = avg(acuteStrains)
    const chronicLoad = chronicStrains.length >= 14 ? avg(chronicStrains) : null
    const acwr = acuteLoad != null && chronicLoad != null && chronicLoad > 0
      ? +(acuteLoad / chronicLoad).toFixed(2)
      : null
    const acwrBand = (r: number) => r < 0.8 ? 'undertrained' : r <= 1.3 ? 'optimal' : r <= 1.5 ? 'elevated' : 'spike_risk'

    let monotony: number | null = null
    if (acuteStrains.length >= 4) {
      const wm = avg(acuteStrains)!
      const wSS = acuteStrains.reduce((s, v) => s + (v - wm) ** 2, 0)
      const wSD = Math.sqrt(wSS / (acuteStrains.length - 1))
      if (wSD > 0) monotony = +(wm / wSD).toFixed(2)
    }

    const acwrLabel: Record<string, string> = {
      undertrained: 'undertrained (<0.8) — wolumen poniżej bazy chronicznej',
      optimal: 'sweet spot ✓ (0.8–1.3)',
      elevated: 'podwyższony (1.3–1.5) — obserwuj oznaki przeciążenia',
      spike_risk: '⚠️ SPIKE (>1.5) — wyraźne ryzyko kontuzji',
    }

    // ── e1RM progression (w3+w2+w1 baseline vs w0) ───────────────────────────
    const e1RMBase: Record<string, number[]> = {}
    const e1RMWeek: Record<string, number[]> = {}
    for (const w of [...workoutsByWeek[3], ...workoutsByWeek[2], ...workoutsByWeek[1]]) {
      for (const l of (w.exercise_logs || []).filter((l: any) => Number(l.weight) > 0 && Number(l.reps) > 0)) {
        const e = epley(Number(l.weight), Number(l.reps))
        if (e) { (e1RMBase[l.exercise_name] ??= []).push(e) }
      }
    }
    for (const w of workoutsByWeek[0]) {
      for (const l of (w.exercise_logs || []).filter((l: any) => Number(l.weight) > 0 && Number(l.reps) > 0)) {
        const e = epley(Number(l.weight), Number(l.reps))
        if (e) { (e1RMWeek[l.exercise_name] ??= []).push(e) }
      }
    }
    const progressionLines: string[] = []
    for (const name of Object.keys(e1RMBase).filter(n => e1RMWeek[n] && e1RMBase[n].length >= 3)) {
      const baseMax = Math.max(...e1RMBase[name])
      const weekMax = Math.max(...e1RMWeek[name])
      const p = ((weekMax - baseMax) / baseMax) * 100
      if (Math.abs(p) >= 2) progressionLines.push(`${name}: ${p > 0 ? '+' : ''}${p.toFixed(1)}% e1RM (${weekMax.toFixed(1)}kg vs 3-tygodniowy maks ${baseMax.toFixed(1)}kg)`)
    }

    // ── Last session per exercise (dla prescrypcji siłowej) ──────────────────
    // Zbieramy wszystkie sesje posortowane od najnowszej
    const allWorkoutsSorted = [...workoutsAll].sort((a: any, b: any) => b.date.localeCompare(a.date))
    const lastSessionByEx: Record<string, { date: string; sets: any[]; e1rm: number | null }> = {}

    for (const w of allWorkoutsSorted) {
      const logs = (w.exercise_logs || []).filter((l: any) =>
        !ACTIVITY_KW.test(l.exercise_name || '') && l.exercise_name?.trim()
      )
      for (const l of logs) {
        if (!lastSessionByEx[l.exercise_name]) {
          // pierwsza (= najnowsza) wzmianka o tym ćwiczeniu — zapisz wszystkie sety z tej sesji
          const allSetsThisSession = logs.filter((x: any) => x.exercise_name === l.exercise_name)
          const bestE1rm = allSetsThisSession.reduce((best: number | null, s: any) => {
            const e = epley(Number(s.weight), Number(s.reps))
            return e && (best === null || e > best) ? e : best
          }, null)
          lastSessionByEx[l.exercise_name] = { date: w.date, sets: allSetsThisSession, e1rm: bestE1rm }
        }
      }
    }

    // All-time best e1RM per exercise
    const allTimeE1rm: Record<string, number> = {}
    for (const w of allWorkoutsSorted) {
      for (const l of (w.exercise_logs || []).filter((l: any) => Number(l.weight) > 0 && Number(l.reps) > 0)) {
        const e = epley(Number(l.weight), Number(l.reps))
        if (e && (!allTimeE1rm[l.exercise_name] || e > allTimeE1rm[l.exercise_name])) {
          allTimeE1rm[l.exercise_name] = e
        }
      }
    }

    // Format exercise history for prompt
    const exerciseHistoryLines = Object.entries(lastSessionByEx)
      .sort(([, a], [, b]) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .map(([name, info]) => {
        const setBySn = [...info.sets].sort((a, b) => a.set_number - b.set_number)
        const setsStr = setBySn.map((s: any) => {
          const parts = [`${s.weight || 0}kg×${s.reps || 0}`]
          if (s.rir != null) parts.push(`RIR${s.rir}`)
          if (s.rpe != null) parts.push(`RPE${s.rpe}`)
          if (s.is_pws_or_msp) parts.push('MSP')
          return parts.join(' ')
        }).join(' | ')
        const e1rm = allTimeE1rm[name]
        return `  ${name} [${info.date}]: ${setsStr}${e1rm ? ` → e1RM ~${e1rm.toFixed(0)}kg` : ''}`
      }).join('\n')

    // ── Plan compliance (ten tydzień) ─────────────────────────────────────────
    const complianceLines: string[] = []
    for (const p of planContext.filter((p: any) => p.planned_date <= today)) {
      const date = p.planned_date
      const hasRun = stravaByWeek[0].some((a: any) => warsaw(new Date(a.start_date)) === date && /run/i.test(a.sport_type || ''))
      const hasWorkout = workoutsByWeek[0].some((w: any) => w.date === date)
      const done = hasRun || hasWorkout
      const wtype = p.workout_type
      const typeLabel = wtype === 1 ? 'Wyścig' : wtype === 2 ? 'Długi bieg' : 'Trening/bieg'
      complianceLines.push(`  ${date} [${typeLabel}] ${p.workout_name}: ${done ? '✓ WYKONANE' : '✗ BRAK'}`)
    }

    // ── Day-by-day: ten tydzień ───────────────────────────────────────────────
    const w0Dates = [...new Set([
      ...strainByWeek[0].map((r: any) => r.date),
      ...ouraByWeek[0].map((r: any) => r.date),
      ...workoutsByWeek[0].map((w: any) => w.date),
      ...stravaByWeek[0].map((a: any) => warsaw(new Date(a.start_date))),
    ])].sort()

    const dayLines: string[] = []
    for (const date of w0Dates) {
      const s = strainByWeek[0].find((r: any) => r.date === date)
      const o = ouraByWeek[0].find((r: any) => r.date === date)
      const ws = workoutsByWeek[0].filter((w: any) => w.date === date)
      const runs = stravaByWeek[0].filter((a: any) => warsaw(new Date(a.start_date)) === date && /run/i.test(a.sport_type || ''))

      const parts: string[] = [`[${date}]`]

      if (o?.readiness_score != null || o?.hrv_avg != null)
        parts.push(`  readiness ${o?.readiness_score ?? '—'} | HRV ${fmt(Number(o?.hrv_avg), 0, 'ms')} | sen ${fmt(Number(o?.total_sleep_hours), 1, 'h')}`)

      if (s?.strain_score != null)
        parts.push(`  strain ${fmt(Number(s.strain_score))}`)

      for (const w of ws) {
        const realLogs = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || ''))
        const saunaMin = (w.exercise_logs || []).filter((l: any) => SAUNA_KW.test(l.exercise_name || '')).reduce((sum: number, l: any) => sum + (Number(l.reps) || 0), 0)
        const byEx: Record<string, any[]> = {}
        for (const l of realLogs) { (byEx[l.exercise_name] ??= []).push(l) }
        const exStr = Object.entries(byEx).map(([name, sets]) => {
          const best = sets.reduce((b: any, s: any) => { const e = epley(Number(s.weight), Number(s.reps)); const bE = b ? epley(Number(b.weight), Number(b.reps)) : 0; return e && e > (bE || 0) ? s : b }, null)
          const rirAvg = avg(sets.filter((s: any) => s.rir != null).map((s: any) => Number(s.rir)))
          return `    ${name} ${sets.length}s${best ? ` top:${best.weight}×${best.reps}` : ''}${rirAvg != null ? ` RIR${rirAvg.toFixed(1)}` : ''}`
        }).join('\n')
        parts.push(`  siłownia [${w.workout_day}]${w.msp_passed ? ' ⭐MSP' : ''}${w.duration_minutes ? ` ${w.duration_minutes}min` : ''}:`)
        if (exStr) parts.push(exStr)
        if (saunaMin > 0) parts.push(`  sauna ${saunaMin}min`)
      }

      for (const r of runs) {
        const type = classifyRun(r)
        const dist = r.distance ? `${(r.distance / 1000).toFixed(1)}km` : '—'
        const pace = fmtPace(r.moving_time, r.distance)
        const hr = r.hr_avg ? `HR${Math.round(r.hr_avg)}${z2Ceiling ? (r.hr_avg > (thresholdHr || 999) ? ' ⚠️powyżej progu' : r.hr_avg > (z2Ceiling || 999) ? ' [strefa 3-4]' : ' [Z2]') : ''}` : ''
        const rpe = r.perceived_exertion ? `RPE${r.perceived_exertion}` : ''
        const pr = r.has_pr ? '🏆PR' : ''
        parts.push(`  ${type}: "${r.name}" ${dist} ${pace}${hr ? ` ${hr}` : ''}${rpe ? ` ${rpe}` : ''}${pr ? ` ${pr}` : ''}`)

        if (r.gc_enriched_at) {
          const gcLine: string[] = []
          if (r.gc_training_effect_aerobic != null) gcLine.push(`TE aerob ${r.gc_training_effect_aerobic}`)
          if (r.gc_training_effect_anaerobic != null) gcLine.push(`TE anaerob ${r.gc_training_effect_anaerobic}`)
          if (r.gc_vo2max != null) gcLine.push(`VO2max ${r.gc_vo2max}`)
          if (r.gc_weather?.temp_c != null) gcLine.push(`${r.gc_weather.temp_c}°C${r.gc_weather.condition ? ` ${r.gc_weather.condition}` : ''}`)
          if (gcLine.length) parts.push(`    [GC] ${gcLine.join(' | ')}`)

          const zonesStr = fmtGcZones(r.gc_hr_zones)
          if (zonesStr) parts.push(`    [GC] strefy HR: ${zonesStr}`)

          if (Array.isArray(r.gc_laps) && r.gc_laps.length) {
            const lapStr = r.gc_laps
              .filter((l: any) => l.distance >= 900)
              .map((l: any) => `Km${l.lap}:${fmtPace(l.duration, l.distance)}${l.avg_hr ? ` HR${Math.round(l.avg_hr)}` : ''}`)
              .join(' ')
            if (lapStr) parts.push(`    [GC] km-splity: ${lapStr}`)
          }
        }
      }

      dayLines.push(parts.join('\n'))
    }

    // ── Plan context ──────────────────────────────────────────────────────────
    const planText = planContext.length > 0
      ? planContext.map((p: any) => {
          const tgt = [p.target_distance_km ? `${p.target_distance_km}km` : null, p.target_pace_min_km ? `@${p.target_pace_min_km}/km` : null, p.target_hr_max ? `HR<${p.target_hr_max}` : null].filter(Boolean).join(' ')
          const goal = p.goal ? ` | Cel fazy: ${p.goal.slice(0, 80)}` : ''
          return `  ${p.planned_date} T${p.workout_type}: ${p.workout_name}${tgt ? ` — ${tgt}` : ''}${goal}`
        }).join('\n')
      : '  (brak aktywnego planu)'

    // ── Muscle coverage ───────────────────────────────────────────────────────
    const weekMuscleTags = [...new Set(
      workoutsByWeek[0].flatMap((w: any) => w.exercise_logs || []).flatMap((l: any) => Array.isArray(l.muscle_tags) ? l.muscle_tags : []).filter(Boolean)
    )]

    // ── CoachBrain: deterministic hybrid-strength signals before LLM ─────────
    const patternStats: Record<string, {
      label: string
      sets28: number
      setsW0: number
      lastDate: string | null
      daysSince: number | null
      avgRir: number | null
      fatigue: 'low' | 'medium' | 'high'
    }> = Object.fromEntries(PATTERN_RULES.map(r => [r.key, {
      label: r.label, sets28: 0, setsW0: 0, lastDate: null, daysSince: null, avgRir: null, fatigue: 'low' as const,
    }]))
    const rirByPattern: Record<string, number[]> = Object.fromEntries(PATTERN_RULES.map(r => [r.key, []]))

    for (const w of workoutsAll) {
      const week = weekOf(w.date, now, warsaw)
      for (const l of (w.exercise_logs || [])) {
        if (ACTIVITY_KW.test(l.exercise_name || '')) continue
        const patterns = exercisePatterns(l.exercise_name || '', Array.isArray(l.muscle_tags) ? l.muscle_tags : [])
        const rir = l.rir != null ? Number(l.rir) : (l.rpe != null ? Number(l.rpe) : null)
        for (const p of patterns) {
          const s = patternStats[p]
          if (!s) continue
          s.sets28++
          if (week === 0) s.setsW0++
          if (!s.lastDate || w.date > s.lastDate) s.lastDate = w.date
          if (rir != null && Number.isFinite(rir)) rirByPattern[p].push(rir)
        }
      }
    }

    for (const [key, s] of Object.entries(patternStats)) {
      s.daysSince = dayDiff(s.lastDate, today)
      s.avgRir = avg(rirByPattern[key]) != null ? +(avg(rirByPattern[key])!).toFixed(1) : null
      s.fatigue = classifyFatigue([key], s.avgRir, s.setsW0)
    }

    const pushSets = patternStats.push?.sets28 ?? 0
    const pullSets = patternStats.pull?.sets28 ?? 0
    const pushPullRatio = pullSets > 0 ? +(pushSets / pullSets).toFixed(2) : null
    const strengthGapDays = allWorkoutsSorted[0]?.date ? dayDiff(allWorkoutsSorted[0].date, today) : null
    const recentHardRuns = stravaByWeek[0].filter((r: any) =>
      /run/i.test(r.sport_type || '') && thresholdHr != null && Number(r.hr_avg) > thresholdHr
    ).length
    const hasUpcomingRunPlan = planContext.some((p: any) => p.planned_date > today && p.planned_date <= warsaw(new Date(now.getTime() + 3 * 864e5)))
    const highReadiness = w0.recovAvg != null && w0.recovAvg >= 75
    const lowStrain = w0.strainAvg != null && w0.strainAvg < (baseStrain ?? 12) * 0.85
    const strengthWindow = highReadiness && lowStrain && (strengthGapDays == null || strengthGapDays >= 4)

    const gapRules = [
      { key: 'calf', maxDays: 7, reason: 'łydka/Achilles musi amortyzować kilometraż biegowy' },
      { key: 'single_leg', maxDays: 10, reason: 'stabilizacja miednicy i kolana pod bieganie' },
      { key: 'tibialis', maxDays: 14, reason: 'stopa/piszczelowy jako ubezpieczenie łydki i piszczeli' },
      { key: 'hinge', maxDays: 10, reason: 'posterior chain dla siły biodra i ekonomii biegu' },
      { key: 'core', maxDays: 10, reason: 'core/antyrotacja dla kontroli miednicy' },
      { key: 'pull', maxDays: 10, reason: 'plecy równoważą pressing i postawę' },
    ]
    const strengthGaps = gapRules
      .map(g => ({ ...g, daysSince: patternStats[g.key]?.daysSince, sets28: patternStats[g.key]?.sets28 ?? 0 }))
      .filter(g => g.daysSince == null || g.daysSince > g.maxDays || g.sets28 === 0)
      .sort((a, b) => (PATTERN_RULES.find(r => r.key === b.key)?.priority ?? 0) - (PATTERN_RULES.find(r => r.key === a.key)?.priority ?? 0))

    const coachDecisions: string[] = []
    if (strengthWindow) coachDecisions.push('Okno na pełną sesję siłową: readiness wysokie, strain niski, przerwa od siłowni wystarczająca.')
    else if (w0.recovAvg != null && w0.recovAvg < 65) coachDecisions.push('Nie dokładaj ciężkich nóg: readiness niskie, lepiej upper/prehab/RIR 3-4.')
    if (strengthGaps.length) coachDecisions.push(`Priorytet siłowy: ${strengthGaps.slice(0, 3).map(g => patternStats[g.key]?.label).join(', ')}.`)
    if (pushPullRatio != null && pushPullRatio > 1.4) coachDecisions.push(`Push/pull ${pushPullRatio}: za dużo pressingu względem pleców, dołóż pull.`)
    if (recentHardRuns >= 2) coachDecisions.push(`Dwa mocne biegi w W0: nie dokładaj ego-liftingu nóg; wybierz kontrolowany RIR 2-3 i prehab.`)
    if (hasUpcomingRunPlan) coachDecisions.push('W planie jest bieg w kolejnych 72h: ciężkie nogi tylko jeśli nie kolidują z akcentem biegowym.')

    const orderedPatternKeys = [
      ...strengthGaps.map(g => g.key),
      ...(pushPullRatio != null && pushPullRatio > 1.4 ? ['pull'] : []),
      'hinge', 'calf', 'single_leg', 'pull', 'push', 'core',
    ].filter((v, i, arr) => arr.indexOf(v) === i)

    const lowInterference = recentHardRuns >= 2 || hasUpcomingRunPlan || (w0.recovAvg != null && w0.recovAvg < 70)
    const sessionBlueprint = orderedPatternKeys
      .flatMap(key => {
        const choices = EXERCISE_LIBRARY[key] || []
        const first = choices[0]
        if (!first) return []
        const legPattern = LEG_PATTERN_KEYS.has(key)
        const adjustedSetsReps = lowInterference && legPattern
          ? first.setsReps.replace(/^4×/, '3×').replace(/^3×5$/, '2×5').replace(/^3×6-8$/, '2×6')
          : first.setsReps
        return [{
          pattern: key,
          exercise: first.name,
          sets_reps: adjustedSetsReps,
          load: loadHint(first.name, lowInterference && legPattern ? null : first.intensity, allTimeE1rm, first.fallbackLoad),
          target_rir: lowInterference && legPattern ? 'RIR 3' : key === 'calf' ? 'RIR 1-2' : 'RIR 2',
          goal: first.goal,
          interference_cost: LEG_PATTERN_KEYS.has(key) ? (lowInterference ? 'medium' : 'high') : 'low',
        }]
      })
      .slice(0, 7)

    const hasCalf = sessionBlueprint.some(x => x.pattern === 'calf')
    const hasSingleLeg = sessionBlueprint.some(x => x.pattern === 'single_leg')
    const hasPull = sessionBlueprint.some(x => x.pattern === 'pull')
    const hasHeavyLeg = sessionBlueprint.some(x => x.interference_cost === 'high')
    const criticScores = {
      hypertrophy_score: Math.min(10, 4 + sessionBlueprint.length + (hasPull ? 1 : 0)),
      strength_score: Math.min(10, 3 + (sessionBlueprint.some(x => ['hinge', 'squat', 'push', 'pull'].includes(x.pattern)) ? 3 : 0) + (strengthWindow ? 2 : 0)),
      running_support_score: Math.min(10, 3 + (hasCalf ? 2 : 0) + (hasSingleLeg ? 2 : 0) + (sessionBlueprint.some(x => x.pattern === 'core') ? 1 : 0)),
      injury_prevention_score: Math.min(10, 2 + (hasCalf ? 2 : 0) + (hasSingleLeg ? 2 : 0) + (sessionBlueprint.some(x => x.pattern === 'tibialis') ? 2 : 0)),
      interference_risk: hasHeavyLeg && (recentHardRuns >= 2 || hasUpcomingRunPlan) ? 'high' : hasHeavyLeg ? 'medium' : 'low',
      critique: [] as string[],
    }
    if (!hasCalf) criticScores.critique.push('Brakuje łydki/Achillesa w blueprintcie.')
    if (!hasSingleLeg) criticScores.critique.push('Brakuje single-leg stabilizacji.')
    if (criticScores.interference_risk === 'high') criticScores.critique.push('Za wysoki koszt nóg względem biegania w oknie 72h.')

    const coachSignals = {
      role: 'reverse_engineered_hybrid_strength_coach',
      strength_gap_days: strengthGapDays,
      strength_window: strengthWindow,
      high_readiness: highReadiness,
      low_strain: lowStrain,
      recent_hard_runs: recentHardRuns,
      upcoming_run_plan_72h: hasUpcomingRunPlan,
      push_pull_ratio: pushPullRatio,
      pattern_stats: patternStats,
      priority_gaps: strengthGaps.slice(0, 6),
      deterministic_decisions: coachDecisions,
      session_blueprint: sessionBlueprint,
      critic_scores: criticScores,
      session_bias: strengthWindow
        ? 'full_strength_with_posterior_chain_calf_single_leg'
        : recentHardRuns >= 2 || hasUpcomingRunPlan
          ? 'upper_prehab_calf_low_interference'
          : 'controlled_strength_rir_2_3',
    }

    // ── Build prompt ──────────────────────────────────────────────────────────
    const fmtWeek = (w: ReturnType<typeof wkSummary>, label: string) =>
      `${label}: ${w.km}km bieganie (${w.runCount} biegów${w.hasLongRun ? ', w tym DŁUGI' : ', BEZ długiego'}, maks ${w.maxRunKm}km) | ${w.sets} serii siłowych | strain śr ${fmt(w.strainAvg)} | readiness śr ${fmt(w.recovAvg, 0)} | HRV śr ${fmt(w.hrvAvg, 0, 'ms')} | sen ${fmt(w.sleepAvg, 1, 'h')} | sauna ${w.saunaCount}x`

    const systemPrompt = `Jesteś elitarnym trenerem hybrydowym klasy premium (poziom opieki 10 000 USD/miesiąc): łączysz hipertrofię, siłę, sylwetkę, odporność tkanek, prewencję kontuzji i wydolność bez psucia pracy trenera biegowego.

KONTEKST WSPÓŁPRACY:
- Sportowiec MA bardzo dobrego trenera biegowego. Ten trener prowadzi plan biegowy: kilometraż tygodniowy, jednostki, tempo, long runy i periodyzację biegową.
- Nie jesteś od przepisywania planu biegowego ani od pouczania "biegaj więcej/mniej" jako głównej rekomendacji.
- Masz prawo komentować bieganie, ale z wyczuciem: jako kontekst dla siłowni, regeneracji, ryzyka, interferencji i priorytetów tygodnia. Możesz powiedzieć "priorytetem dla trenera biegowego jest long run / Z2 / dystrybucja intensywności", ale nie przejmujesz steru.
- Twoja główna wartość: co zrobić na siłowni, jak progresować, jakie ćwiczenia dobrać, jak budować sylwetkę i siłę bez zabijania biegania.

TWOJE PRIORYTETY — w tej kolejności:
1. SIŁOWNIA I SYLWETKA — progresja, dobór ćwiczeń, objętość, intensywność, słabe ogniwa, hipertrofia i siła.
2. PREWENCJA KONTUZJI — łydki, stopy, piszczelowy, pośladek średni, hamstringi, single-leg, core, mobilność i tkanki pod bieganie.
3. CONCURRENT TRAINING BALANCE — jak siłownia ma wspierać bieganie, a nie interferować: nogi vs akcenty biegowe, RIR/RPE, dobór dnia, zmęczenie CNS.
4. HOLISTYKA — sen, readiness, strain, HRV, żywienie, sauna i stres jako ograniczenia lub okna na mocniejszy bodziec.
5. BIEGANIE — tylko jako kontekst i druga opinia; formułuj uwagi z szacunkiem do istniejącego trenera biegowego.

STYL ANALIZY:
- Brzmisz jak realny trener prowadzący ambitnego podopiecznego, nie jak aplikacja fitness. Konkret, hierarchia, decyzje.
- Najpierw mów, co to oznacza dla siłowni: czy dokładamy, cofamy, zmieniamy ćwiczenia, przesuwamy akcent, trzymamy RIR.
- Konkretne liczby zawsze. Nie "za mało pracy", ale "0 serii siłowych vs norma 19; przy readiness 82 można wejść w sesję posterior chain bez dokładania intensywnego biegania".
- Diagnozy, nie opisy. Szukaj PRZYCZYNY, nie tylko objawu.
- Rekomendacje biegowe formułuj miękko i koordynacyjnie: "do omówienia z trenerem biegowym", "priorytet biegowy wygląda na...", "nie dokładałbym samowolnie".
- Specyficzne sesje siłowe w rekomendacjach: ćwiczenie, serie, powtórzenia, ciężar/RPE/RIR, cel adaptacyjny.
- Jeśli tydzień wyglądał jak celowy deload (niski strain + wysoki recovery + plan mówi coś innego) — powiedz to wprost
- Flagi ryzyka kontuzji: brak ekscentrycznego treningu łydek przy rosnącym km-rażu, brak single-leg work, brak nóg przez >2 tyg, HR na biegach >88% HRmax regularnie
- Rozdzielaj cztery rzeczy: (1) wolumen km, (2) strukturę maratońską, (3) dystrybucję intensywności, (4) ciągłość siłowni. Nie wolno mieszać ich w jeden werdykt.
- Jeśli km w W0 >= norma z W-1..W-3, nie pisz "za mało biegania" ani "wolumen biegowy za mały". Możesz napisać: "km jest OK, ale bodziec/struktura nie są maratońskie".
- Jeśli ACWR/strain jest niski, nazywaj to "niski bodziec fizjologiczny" albo "niski koszt", nie automatycznie "za mało km".
- Recovery/readiness wysokie przy niskim strain opisuj jako "wysoka gotowość / niski koszt ostatnich dni", nie jako pewną "nadregenerację".
- Nie używaj katastroficznych tez typu "ryzyko przetrenowania układu nerwowego" przy niskim ACWR i niskim/umiarkowanym km. Trafniejszy język: "zła dystrybucja intensywności" albo "ryzyko przeciążenia przy braku bazy".
- W rekomendacjach priorytet 1 i 2 domyślnie mają dotyczyć siłowni/progresji/prewencji/integracji hybrydowej. Rekomendacja czysto biegowa tylko jeśli jest krytyczna i sformułowana jako temat do uzgodnienia z trenerem biegowym.

KONTEKST DNIA TYGODNIA — BARDZO WAŻNE:
- Dzisiaj jest ${todayDowLabel} (${todayDow}/7 tygodnia). W0 to bieżące okno/tydzień w toku, NIE zamknięty tydzień.
- W poniedziałek i wtorek nie wolno pisać, że "ten tydzień jest słaby/zerowy/nie zbliżył do maratonu" tylko dlatego, że W0 ma mało km/serii. To jest za wcześnie.
- Porównuj W0 do normy pro-rata do dzisiaj: bieganie oczekiwane do teraz ~${expectedRunKmToDate}km z normy ${baseRunKm.toFixed(1)}km/tydz; siłownia ~${expectedSetsToDate} serii z normy ${Math.round(baseSets)} serii/tydz${expectedStrainToDate != null ? `; strain orientacyjnie ~${expectedStrainToDate} z normy ${baseStrain?.toFixed(1)}` : ''}.
- Krytykuj opóźnienie tygodnia tylko gdy jest realna zaległość względem planu zaplanowanego DO DZISIAJ albo gdy jest czwartek/piątek/weekend i nadal brakuje kluczowych bodźców.
- Jeśli jest wcześnie w tygodniu i plan ma sesje później, formułuj to jako "tydzień jeszcze otwarty; do wykonania X/Y", nie jako regres.

W polu "strength_prescription" zawsze podajesz KONKRETNĄ następną sesję siłową:
- Minimalne 5-7 ćwiczeń (nie ogólniki — konkretne ćwiczenia: wyciskanie płaskie, martwy ciąg, podciąganie, dipy, itp.)
- Każde ćwiczenie: dokładne obciążenie obliczone z e1RM (np. jeśli e1RM=97kg, seria 5 = ~86% = 83kg; seria 8 = ~80% = 77.5kg)
- Logika periodyzacji: czy intensywność/objętość po ostatniej sesji
- Jeśli brak danych e1RM dla ćwiczenia — napisz "RPE 7-8" zamiast kg
- Pole strength_prescription.exercises ma bazować na COACHBRAIN.session_blueprint. Możesz dopracować nazwy i kolejność, ale nie ignoruj priorytetów ani critic_scores.
- Jeśli critic_scores.interference_risk jest high, nie dawaj ciężkiego hinge/squat jako głównego bodźca; użyj wariantu low-interference, RIR 3, więcej prehab/upper.

Mówisz po polsku. Jesteś bezpośredni. Nie motywujesz — analizujesz.`

    const userMsg = `PROFIL SPORTOWCA (szacunki z ostatnich 28 dni):
HRmax (maks HR widziany w danych): ${hrMax ?? '— (brak danych HR)'}
Z2 ceiling (76% HRmax): ${z2Ceiling ?? '—'} BPM | Próg tlenowy (~88% HRmax): ${thresholdHr ?? '—'} BPM

KALENDARZ ANALIZY:
Dzisiaj: ${today} (${todayDowLabel}, dzień ${todayDow}/7). W0 jest w toku, nie jest zamkniętym tygodniem.
Norma tygodniowa z W-1..W-3: bieganie ${baseRunKm.toFixed(1)}km/tydz, siłownia ${Math.round(baseSets)} serii/tydz${baseStrain != null ? `, strain ${baseStrain.toFixed(1)}` : ''}.
Oczekiwane pro-rata do dzisiaj: bieganie ~${expectedRunKmToDate}km, siłownia ~${expectedSetsToDate} serii${expectedStrainToDate != null ? `, strain ~${expectedStrainToDate}` : ''}.
Status tygodnia: ${earlyWeek ? 'WCZESNY TYDZIEŃ — nie oceniaj W0 jak pełnego tygodnia' : midWeek ? 'ŚRODEK TYGODNIA — oceniaj względem planu do dzisiaj i braków na resztę tygodnia' : 'KOŃCÓWKA TYGODNIA — można mocniej oceniać braki W0'}.

KONTRAKT TRENINGOWY:
Plan biegowy prowadzi osobny, dobry trener. Twoim głównym obszarem jest siłownia, sylwetka, progresja, prewencja i integracja z bieganiem. Komentarze biegowe są mile widziane, ale jako druga opinia i kontekst, nie jako przejmowanie planu.

WSKAŹNIKI OBCIĄŻENIA (ACWR/Monotonia):
${acwr != null ? `ACWR (7d acute / 28d chronic): ${acwr.toFixed(2)} → ${acwrLabel[acwrBand(acwr)]}` : 'ACWR: za mało danych (min. 14 dni historii strain)'}
${monotony != null ? `Monotonia treningowa (Foster): ${monotony.toFixed(2)} → ${monotony >= 2.0 ? '⚠️ wysoka — zbyt podobny bodziec każdego dnia, ryzyko przetrenowania' : 'OK (<2.0)'}` : 'Monotonia: za mało danych (min. 4 aktywne dni w tygodniu)'}
Chronic baseline strain: ${chronicLoad != null ? fmt(chronicLoad) : '—'}/21 | Acute (7d): ${acuteLoad != null ? fmt(acuteLoad) : '—'}/21

TREND 4-TYGODNIOWY (od najstarszego do najnowszego):
${fmtWeek(w3, 'W-3 (3 tygodnie temu)')}
${fmtWeek(w2, 'W-2 (2 tygodnie temu)')}
${fmtWeek(w1, 'W-1 (poprzedni tydzień)')}
${fmtWeek(w0, 'W0 (TEN TYDZIEŃ)')}

TEN TYDZIEŃ — DZIEŃ PO DNIU:
${dayLines.length ? dayLines.join('\n\n') : '(brak danych)'}

PARTIE MIĘŚNIOWE TRENOWANE W TYM TYGODNIU: ${weekMuscleTags.length ? weekMuscleTags.join(', ') : '— (brak tagów)'}

PROGRESJA SIŁOWA (e1RM ten tydzień vs 3-tygodniowy maks):
${progressionLines.length ? progressionLines.join('\n') : '(zbyt mało danych do porównania)'}

PLAN MARATOŃSKI — BIEŻĄCY TYDZIEŃ:
${planText}

COMPLIANCE PLANU (ten tydzień):
${complianceLines.length ? complianceLines.join('\n') : '(brak planu lub brak danych)'}

HISTORIA ĆWICZEŃ SIŁOWYCH (ostatnia sesja + e1RM):
${exerciseHistoryLines || '(brak danych)'}

COACHBRAIN — DETERMINISTYCZNE SYGNAŁY TRENERA HYBRYDOWEGO:
Traktuj te sygnały jako szkielet decyzji. Nie wymyślaj sprzecznej narracji, tylko dobierz język i sesję.
${JSON.stringify(coachSignals, null, 2)}

---
Odpowiedz WYŁĄCZNIE surowym obiektem JSON (bez markdown, bez żadnego tekstu poza JSON):
{
  "load_status": "elevated|optimal|undertrained",
  "volume_status": "low|ok|high",
  "structure_status": "missing_long_run|ok|chaotic|unknown",
  "intensity_status": "too_hard|ok|too_easy|unknown",
  "strength_continuity": "gap|ok|overloaded|unknown",
  "coach_decision_summary": "1 zdanie — najważniejsza deterministyczna decyzja CoachBrain: pełna siłownia / upper+prehab / deload / pull priority itd.",
  "load_summary": "1 konkretne zdanie — rozdziel km od bodźca: np. 'Km 14.2 vs norma 10.9 jest OK, ale ACWR 0.68 i brak długiego biegu = niski bodziec maratoński'",
  "recovery_status": "deficit|ok|surplus",
  "recovery_summary": "1 zdanie — stan gotowości; jeśli recovery wysokie przy niskim strain, pisz 'wysoka gotowość / niski koszt', nie 'nadregeneracja'",
  "training_trajectory": "1-2 zdania — osobno oceń trend siłowni i wpływ biegania na siłownię; trend km komentuj tylko jako kontekst pracy trenera biegowego",
  "marathon_readiness": "1 zdanie — druga opinia hybrydowa o bieganiu z szacunkiem do trenera biegowego; np. 'biegowo temat dla trenera, z perspektywy siłowni priorytetem jest łydka/single-leg pod tę strukturę'",
  "injury_risk": {
    "level": "low|moderate|high",
    "flags": ["konkretny sygnał ryzyka z liczbami jeśli jest", "..."],
    "prevention": "1-2 zdania — co zrobić żeby zapobiec lub co wdrożyć od razu"
  },
  "strength_note": "1 zdanie — najważniejsza decyzja siłowa tygodnia: progresja, deload, akcent, ograniczenie albo zmiana ćwiczeń",
  "missing_muscles": ["partie lub wzorce ruchowe których brakuje dla sylwetki, siły i odporności biegacza — max 4, [] jeśli OK"],
  "sauna_note": "1 zdanie — sauna vs norma i dlaczego to ważne w kontekście tego tygodnia",
  "key_insights": [
    "insight 1 — najważniejszy wniosek o siłowni/sylwetce/hybrydzie, zdanie z liczbami",
    "insight 2 — drugi najważniejszy",
    "insight 3 — trzeci"
  ],
  "strength_prescription": {
    "focus": "co ćwiczymy i dlaczego — priorytet siłowy/sylwetkowy z uwzględnieniem biegania, np. 'Posterior chain + łydka + góra: budujemy tył bez zajechania nóg przed akcentem biegowym'",
    "critic": "1 zdanie — ocena blueprintu: hipertrofia/siła/prewencja/interferencja; wskaż największy tradeoff",
    "exercises": [
      {
        "name": "nazwa ćwiczenia po polsku",
        "sets_reps": "np. '4×5' lub '3×8-10'",
        "load": "np. '92.5kg' lub 'BW+20kg' — na podstawie e1RM z historii, obliczone konkretnie",
        "note": "np. 'e1RM ~97kg, poprzednia sesja 90kg×5 RIR2 — czas na 92.5kg'"
      }
    ]
  },
  "recommendations": [
    { "priority": 1, "action": "konkretna akcja siłowa max 10 słów", "reason": "1 zdanie z liczbami — dlaczego to najlepszy ruch dla siły/sylwetki/hybrydy" },
    { "priority": 2, "action": "...", "reason": "..." },
    { "priority": 3, "action": "...", "reason": "..." }
  ]
}`

    // ── DeepSeek API call ─────────────────────────────────────────────────────
    const result = await deepseekChat({
      apiKey,
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      maxTokens: 4000,
      temperature: 0.2,
      timeoutMs: 90000,
    })

    const stripped = result.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`No JSON in response. Raw: ${result.content.slice(0, 300)}`)

    let parsed: any
    try { parsed = JSON.parse(jsonMatch[0]) }
    catch { throw new Error(`JSON parse error. Raw: ${result.content.slice(0, 300)}`) }

    // Attach computed stats for frontend comparison bars
    parsed.stats = {
      week_strain: w0.strainAvg != null ? +w0.strainAvg.toFixed(1) : null,
      base_strain: avg([w1.strainAvg, w2.strainAvg, w3.strainAvg].filter(Boolean) as number[])?.toFixed(1) ?? null,
      week_recovery: w0.recovAvg != null ? Math.round(w0.recovAvg) : null,
      base_recovery: avg([w1.recovAvg, w2.recovAvg, w3.recovAvg].filter(Boolean) as number[]) != null ? Math.round(avg([w1.recovAvg, w2.recovAvg, w3.recovAvg].filter(Boolean) as number[])!) : null,
      week_hrv: w0.hrvAvg != null ? Math.round(w0.hrvAvg) : null,
      base_hrv: avg([w1.hrvAvg, w2.hrvAvg, w3.hrvAvg].filter(Boolean) as number[]) != null ? Math.round(avg([w1.hrvAvg, w2.hrvAvg, w3.hrvAvg].filter(Boolean) as number[])!) : null,
      week_sleep: w0.sleepAvg != null ? +w0.sleepAvg.toFixed(1) : null,
      base_sleep: avg([w1.sleepAvg, w2.sleepAvg, w3.sleepAvg].filter(Boolean) as number[]) != null ? +(avg([w1.sleepAvg, w2.sleepAvg, w3.sleepAvg].filter(Boolean) as number[])!.toFixed(1)) : null,
      week_sets: w0.sets,
      base_sets_pw: Math.round(avg([w1.sets, w2.sets, w3.sets]) ?? 0),
      week_run_km: w0.km,
      base_run_km_pw: +(avg([w1.km, w2.km, w3.km])?.toFixed(1) ?? '0'),
      week_sauna: w0.saunaCount,
      base_sauna_pw: +(avg([w1.saunaCount, w2.saunaCount, w3.saunaCount])?.toFixed(1) ?? '0'),
      muscle_tags: weekMuscleTags,
      hr_max: hrMax,
      z2_ceiling: z2Ceiling,
      today,
      day_of_week: todayDow,
      day_of_week_label: todayDowLabel,
      week_progress: +weekProgress.toFixed(2),
      early_week: earlyWeek,
      expected_run_km_to_date: expectedRunKmToDate,
      expected_sets_to_date: expectedSetsToDate,
      expected_strain_to_date: expectedStrainToDate,
      coach_signals: coachSignals,
      // 4-week trend arrays for sparkline
      km_trend: [w3.km, w2.km, w1.km, w0.km],
      sets_trend: [w3.sets, w2.sets, w1.sets, w0.sets],
      strain_trend: [w3.strainAvg, w2.strainAvg, w1.strainAvg, w0.strainAvg],
      // NOOP-ported load metrics
      acwr,
      acwr_band: acwr != null ? acwrBand(acwr) : null,
      monotony,
      acute_load: acuteLoad != null ? +acuteLoad.toFixed(1) : null,
      chronic_load: chronicLoad != null ? +chronicLoad.toFixed(1) : null,
    }

    console.log(`[analyze-training-load] ${today}: km=${w0.km} sets=${w0.sets} load=${parsed.load_status} injury=${parsed.injury_risk?.level}`)

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
