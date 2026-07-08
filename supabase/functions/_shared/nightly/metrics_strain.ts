import { createServiceClient } from '../supabase.ts'
import { resolveUserScope } from '../supabase.ts'
import { estimateCaffeineMg } from '../caffeineEstimate.ts'
import { getWarsawDateString } from '../time.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const warsawDate = (iso: string) => getWarsawDateString(new Date(iso))

// Klasyfikacja ćwiczeń
const LEG_KW = ['przysiad', 'martwy', 'rdl', 'nog', 'leg', 'łydk', 'lydk', 'hip thrust', 'wykrok', 'lunge', 'calf', 'udo']
const CNS_KW = ['martwy', 'przysiad', 'ohp', 'bench', 'wyciskanie', 'dip']
const WELLNESS_KW = ['sauna', 'lodowata', 'zimny prysznic', 'cold', 'ice']
const matches = (name: string, kws: string[]) => { const n = (name || '').toLowerCase(); return kws.some(k => n.includes(k)) }

// ── NOOP port: Winsorized EWMA baseline (Baselines.swift) ────────────────────
// halfLifeB=14 nights for center, halfLifeS=21 for spread.
// Hard-rejects values >5σ from baseline (post-seed), Winsorizes at ±3σ.
function ewmaBaseline(
  values: number[], minVal: number, maxVal: number, floorSpread: number,
  halfLifeB = 14, halfLifeS = 21
): { center: number; spread: number; nValid: number } | null {
  const lb = 1 - Math.pow(0.5, 1 / halfLifeB)
  const ls = 1 - Math.pow(0.5, 1 / halfLifeS)
  const WINSOR_K = 3.0, HARD_K = 5.0, MIN_SEED = 4
  let center: number | null = null, spread = floorSpread, nValid = 0
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue
    if (v < minVal || v > maxVal) continue
    if (center === null) { center = v; nValid = 1; continue }
    if (nValid >= MIN_SEED && Math.abs(v - center) > HARD_K * spread) continue
    const clamped = Math.max(center - WINSOR_K * spread, Math.min(center + WINSOR_K * spread, v))
    center = lb * clamped + (1 - lb) * center
    spread = Math.max(floorSpread, ls * Math.abs(v - center) + (1 - ls) * spread)
    nValid++
  }
  return center !== null ? { center, spread, nValid } : null
}

// ── NOOP port: ReadinessEngine (ReadinessEngine.swift) ───────────────────────
// Synthesizes HRV z-score, RHR drift, ACWR (Gabbett), monotony (Foster)
// into: primed | balanced | strained | rundown | insufficient
type ReadinessLevel = 'primed' | 'balanced' | 'strained' | 'rundown' | 'insufficient'
type SignalFlag = 'good' | 'neutral' | 'watch' | 'bad'
interface ReadinessSignal { key: string; flag: SignalFlag; detail: string }
interface ReadinessDay {
  date: string
  hrv: number | null
  rhr: number | null
  respRate: number | null
  strain: number | null
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

const sampleSD = (xs: number[]): number | null => {
  if (xs.length < 2) return null
  const m = mean(xs)
  if (m == null) return null
  const ss = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0)
  return Math.sqrt(ss / (xs.length - 1))
}

function computeReadiness(
  days: ReadinessDay[],
  today: string
): { level: ReadinessLevel; signals: ReadinessSignal[] } {
  const BASELINE_WINDOW = 30, MIN_BASELINE = 7, ACUTE_WINDOW = 7, CHRONIC_WINDOW = 28, MIN_CHRONIC = 14
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.find(d => d.date === today) ?? sorted[sorted.length - 1]
  if (!latest) return { level: 'insufficient', signals: [] }
  const history = sorted.filter(d => d.date < latest.date)
  const signals: ReadinessSignal[] = []

  const zSignal = (
    val: number | null, baseline: number[],
    higherBetter: boolean, key: string,
    [good, neutral, watch, bad]: [string, string, string, string]
  ) => {
    if (val == null || baseline.length < MIN_BASELINE) return
    const m = mean(baseline)
    const sd = sampleSD(baseline)
    if (m == null || sd == null || sd <= 0) return
    const z = (higherBetter ? (val - m) : (m - val)) / sd
    const flag: SignalFlag = z >= 0.5 ? 'good' : z >= -0.5 ? 'neutral' : z >= -1.0 ? 'watch' : 'bad'
    signals.push({ key, flag, detail: flag === 'good' ? good : flag === 'neutral' ? neutral : flag === 'watch' ? watch : bad })
  }

  zSignal(latest.hrv, history.slice(-BASELINE_WINDOW).map(d => d.hrv).filter((v): v is number => v != null), true, 'hrv', [
    'powyżej baseline — dobrze zregenerowany',
    'w normalnym zakresie',
    'lekko poniżej baseline',
    'wyraźnie poniżej — zmęczenie autonomiczne',
  ])
  zSignal(latest.rhr, history.slice(-BASELINE_WINDOW).map(d => d.rhr).filter((v): v is number => v != null), false, 'rhr', [
    'poniżej lub na poziomie baseline',
    'w normalnym zakresie',
    'lekko powyżej baseline',
    'podwyższony — przetrenowanie lub choroba',
  ])

  const respBase = history.slice(-BASELINE_WINDOW).map(d => d.respRate).filter((v): v is number => v != null)
  const respSD = sampleSD(respBase)
  const respMean = mean(respBase)
  if (latest.respRate != null && respBase.length >= MIN_BASELINE && respSD != null && respSD > 0 && respMean != null) {
    const z = (latest.respRate - respMean) / respSD
    if (z >= 1.5) signals.push({ key: 'respRate', flag: 'bad', detail: 'oddech powyżej baseline — możliwy wczesny sygnał choroby' })
    else if (z >= 1.0) signals.push({ key: 'respRate', flag: 'watch', detail: 'oddech lekko powyżej baseline' })
  }

  const strainVals = sorted
    .map(d => d.strain)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (strainVals.length >= MIN_CHRONIC) {
    const acute = mean(strainVals.slice(-ACUTE_WINDOW))!
    const chronic = mean(strainVals.slice(-CHRONIC_WINDOW))!
    if (chronic > 0) {
      const ratio = acute / chronic
      const pr = ratio.toFixed(2)
      if (ratio < 0.8)       signals.push({ key: 'acwr', flag: 'watch', detail: `load spada (ACWR ${pr}) — przestrzeń do budowania` })
      else if (ratio < 1.3)  signals.push({ key: 'acwr', flag: 'good',  detail: `load w sweet spot (ACWR ${pr})` })
      else if (ratio < 1.5)  signals.push({ key: 'acwr', flag: 'watch', detail: `load rośnie szybko (ACWR ${pr}) — obserwuj` })
      else                   signals.push({ key: 'acwr', flag: 'bad',   detail: `SPIKE (ACWR ${pr}) — ryzyko kontuzji` })
    }
    const week = strainVals.slice(-ACUTE_WINDOW)
    const wm = mean(week)
    const wSD = sampleSD(week)
    if (week.length >= 4 && wm != null && wSD != null) {
      if (wSD > 0 && wm / wSD >= 2.0)
        signals.push({ key: 'monotony', flag: 'watch', detail: 'niska zmienność — zbyt podobny bodziec każdego dnia' })
    }
  }

  if (!history.length || !signals.length) return { level: 'insufficient', signals }
  const bad = signals.filter(s => s.flag === 'bad').length
  const recovDown = signals.some(s => ['hrv', 'rhr', 'respRate'].includes(s.key) && s.flag === 'bad')
  const loadHigh  = signals.some(s => s.key === 'acwr' && s.flag === 'bad')
  const good = signals.filter(s => s.flag === 'good').length
  const watch = signals.filter(s => s.flag === 'watch').length

  let level: ReadinessLevel
  if (bad >= 2 || (recovDown && loadHigh)) level = 'rundown'
  else if (recovDown || loadHigh || bad >= 1) level = 'strained'
  else if (good >= 2 && watch === 0) level = 'primed'
  else level = 'balanced'
  return { level, signals }
}

function serviceClient() {
  return createServiceClient()
}

export const runComputeDailyStrain = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = serviceClient()
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 2
    const dateFrom: string | null = body.dateFrom ?? null
    const dateTo: string | null = body.dateTo ?? null
    const algoVersion: number = body.algoVersion ?? 1
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null)
    const onlyUserId: string | null = scopedUserId

    let uq = supabase.from('user_settings').select('user_id').not('oura_token', 'is', null)
    if (onlyUserId) uq = uq.eq('user_id', onlyUserId)
    const { data: users, error: uErr } = await uq
    if (uErr) throw uErr

    const now = new Date()
    const todayWarsaw = getWarsawDateString(now)
    const toWarsaw = getWarsawDateString
    const endStr = dateTo || toWarsaw(now)
    const startStr = dateFrom || toWarsaw(new Date(now.getTime() - days * 864e5))
    
    // Calculate start limits relative to startStr
    const startDate = new Date(startStr + 'T12:00:00Z')
    const start90 = toWarsaw(new Date(startDate.getTime() - 90 * 864e5))
    const start30 = toWarsaw(new Date(startDate.getTime() - 30 * 864e5))

    const computeForUser = async (u: any) => {
      const uid = u.user_id
      try {

      // ── Waga (ostatnia) ──
      const { data: bw } = await supabase.from('body_metrics')
        .select('weight').eq('user_id', uid).not('weight', 'is', null)
        .order('date', { ascending: false }).limit(1).maybeSingle()
      const weight = Number(bw?.weight) || 75

      // ── Profil (wiek, płeć → FitnessAge / VitalityEngine) ──
      const { data: profile } = await supabase.from('nutrition_profile')
        .select('birth_date, sex').eq('user_id', uid).maybeSingle()
      const sex = String(profile?.sex ?? 'M').toUpperCase() === 'F' ? 'F' : 'M'
      const ageYears = profile?.birth_date
        ? (now.getTime() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000)
        : 30

      // ── Baseline HRV/RHR (90 dni, chronologicznie dla EWMA) ──
      const { data: base, error: baseErr } = await supabase.from('oura_daily_summary')
        .select('date, hrv_avg, rhr_avg, total_sleep_hours, sleep_score')
        .eq('user_id', uid)
        .gte('date', start90)
        .lte('date', endStr)
        .order('date')
      if (baseErr) console.error(`[strain] user ${uid} baseline query failed, EWMA will fall back to empty history:`, baseErr.message)
      
      const baseByDate: Record<string, any> = {}
      const sleepByDate: Record<string, number> = {}
      for (const row of (base || []) as any[]) {
        baseByDate[row.date] = row
        if (row.total_sleep_hours != null) sleepByDate[row.date] = Number(row.total_sleep_hours)
      }

      const { data: respBase } = await supabase.from('oura_enhanced')
        .select('date, sleep_average_breath, temperature_deviation')
        .eq('user_id', uid)
        .gte('date', start90)
        .lte('date', endStr)
        .order('date')
      const respByDate: Record<string, number | null> = {}
      const skinTempByDate: Record<string, number | null> = {}
      for (const row of (respBase || []) as any[]) {
        respByDate[row.date] = row.sleep_average_breath != null ? Number(row.sleep_average_breath) : null
        skinTempByDate[row.date] = row.temperature_deviation != null ? Number(row.temperature_deviation) : null
      }

      // Dynamic baseline provider to prevent future leak in backfills
      const getBaselinesForDate = (targetDate: string) => {
        const hrvVals = (base || []).filter((r: any) => r.date < targetDate).map((r: any) => r.hrv_avg).filter((v: any): v is number => v != null);
        const rhrVals = (base || []).filter((r: any) => r.date < targetDate).map((r: any) => r.rhr_avg).filter((v: any): v is number => v != null);
        const sleepScoreVals = (base || []).filter((r: any) => r.date < targetDate).map((r: any) => r.sleep_score).filter((v: any): v is number => v != null);
        
        const hrvEwma = ewmaBaseline(hrvVals, 5, 250, 5.0);
        const rhrEwma = ewmaBaseline(rhrVals, 30, 120, 2.0);
        const sleepScoreEwma = ewmaBaseline(sleepScoreVals, 0, 100, 5.0);

        const respVals = (respBase || []).filter((r: any) => r.date < targetDate).map((r: any) => r.sleep_average_breath).filter((v: any): v is number => v != null);
        const respEwma = ewmaBaseline(respVals, 4, 40, 0.5);

        const hrvBase = hrvVals.length ? hrvVals.reduce((x, y) => x + y, 0) / hrvVals.length : null;
        const rhrBase = rhrVals.length ? rhrVals.reduce((x, y) => x + y, 0) / rhrVals.length : null;

        return { hrvEwma, rhrEwma, sleepScoreEwma, respEwma, hrvBase, rhrBase };
      };

      // Strain history for ReadinessEngine (last 30 days, pre-existing rows)
      const { data: strainHistRows } = await supabase.from('daily_strain')
        .select('date, strain_score')
        .eq('user_id', uid)
        .gte('date', start30)
        .lte('date', endStr)
        .order('date')
      const strainHistRunning: Array<{ date: string; strain_score: number | null }> =
        [...(strainHistRows || [])]

      // ── Źródła w oknie (z buforem -1 dnia na "wczoraj") ──
      const winStart = dateFrom 
        ? toWarsaw(new Date(startDate.getTime() - 1 * 864e5))
        : toWarsaw(new Date(now.getTime() - (days + 1) * 864e5))
      const [zonesR, enhR, summR, nutrR, wsR, stravaR, foodR, behaviorR] = await Promise.all([
        supabase.from('oura_hr_zones_daily').select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max').eq('user_id', uid).gte('day', winStart),
        supabase.from('oura_enhanced').select('date, steps, resilience_level').eq('user_id', uid).gte('date', winStart),
        supabase.from('oura_daily_summary').select('date, readiness_score, hrv_avg, rhr_avg, total_sleep_hours, sleep_score').eq('user_id', uid).gte('date', winStart),
        supabase.from('daily_nutrition').select('date, calories, protein, carbs').eq('user_id', uid).gte('date', winStart),
        supabase.from('workout_sessions').select('date, exercise_logs(exercise_name, rpe, rir, reps)').eq('user_id', uid).gte('date', winStart),
        supabase.from('strava_activities_clean').select('start_date, perceived_exertion, has_pr, sport_type, is_oura').eq('user_id', uid).eq('is_oura', false).gte('start_date', winStart + 'T00:00:00'),
        supabase.from('daily_food_entries').select('name, logged_at, date').eq('user_id', uid).gte('date', winStart).not('logged_at', 'is', null),
        supabase.from('behavior_log').select('date, behavior_key, value').eq('user_id', uid).gte('date', winStart),
      ])

      const byKey = <T,>(rows: T[] | null, key: (r: T) => string) => {
        const m: Record<string, T[]> = {}
        for (const r of (rows || [])) { const k = key(r); (m[k] = m[k] || []).push(r) }
        return m
      }
      const zones = byKey(zonesR.data, (r: any) => r.day)
      const enh = byKey(enhR.data, (r: any) => r.date)
      const summ = byKey(summR.data, (r: any) => r.date)
      const nutr = byKey(nutrR.data, (r: any) => r.date)
      const workouts = byKey(wsR.data, (r: any) => r.date)
      const strava = byKey(stravaR.data, (r: any) => warsawDate(r.start_date))
      const food = byKey(foodR.data, (r: any) => r.date)

      const ILLNESS_KEYS = /chorob|illness|unwell|sick|przezi|grypa|flu/i
      // value: 1=lekki(-5), 2=wyraźny(-10), 3=pełna choroba(-18), null=lekki(-5)
      const illnessDates = new Map<string, number>()
      for (const row of (behaviorR.data || []) as any[]) {
        if (ILLNESS_KEYS.test(row.behavior_key)) {
          const severity = Number(row.value) || 1
          const penalty = severity >= 3 ? 18 : severity >= 2 ? 10 : 5
          illnessDates.set(row.date, penalty)
        }
      }

      // ── Iteracja chronologiczna ──
      const dayList: string[] = []
      for (let t = new Date(startStr).getTime(); t <= new Date(endStr).getTime(); t += 864e5) {
        dayList.push(new Date(t).toISOString().split('T')[0])
      }

      let prev: any = null
      const upserts: any[] = []

      for (const date of dayList) {
        const { hrvEwma, rhrEwma, sleepScoreEwma, respEwma, hrvBase, rhrBase } = getBaselinesForDate(date);

        // Dzień bieżący (Europe/Warsaw): log posiłków jeszcze niedomknięty → fueling tymczasowy.
        const fuelingProvisional = date === todayWarsaw
        const z = zones[date]?.[0]
        const e = enh[date]?.[0]
        const s = summ[date]?.[0]
        const n = nutr[date]?.[0]
        const wsets = (workouts[date] || []).flatMap((w: any) => w.exercise_logs || [])
        const runs = strava[date] || []

        // ── CARDIO LOAD (TRIMP-style ze stref Oura + bonus Strava) ──
        let cardioRaw = 0
        if (z) {
          cardioRaw = (z.z1_regen_min || 0) * 0.5 + (z.z2_tlenowa_min || 0) * 1
            + (z.z3_tempo_min || 0) * 2 + (z.z4_prog_min || 0) * 4 + (z.z5_max_min || 0) * 6
        }
        const maxRpe = runs.reduce((m: number, r: any) => Math.max(m, r.perceived_exertion || 0), 0)
        const rpeBonus = maxRpe >= 8 ? 30 : maxRpe >= 6 ? 15 : 0
        const prBonus = runs.some((r: any) => r.has_pr) ? 20 : 0
        const isRunDay = runs.length > 0
        cardioRaw += rpeBonus + prBonus

        // ── STRENGTH LOAD ──
        let strengthPts = 0, legPts = 0, cnsPts = 0, wellnessPts = 0
        for (const set of wsets) {
          if (matches(set.exercise_name, WELLNESS_KW)) {
            // reps = minuty, weight = °C — 1.5 pkt/min, max 25 pkt per set
            wellnessPts += Math.min((set.reps || 0) * 1.5, 25)
            continue
          }
          const isLeg = matches(set.exercise_name, LEG_KW)
          const isCns = matches(set.exercise_name, CNS_KW)
          const setRir = set.rir ?? set.rpe
          const nearFailure = setRir != null && Number(setRir) <= 1
          const pts = 3 + (isLeg ? 2 : 0) + (isCns ? 2 : 0) + (nearFailure ? 2 : 0)
          strengthPts += pts
          if (isLeg) legPts += pts
          if (isCns) cnsPts += pts
        }

        // ── STEPS LOAD ──
        const steps = e?.steps ?? null
        const stepsLoad = steps != null ? Math.min(steps / 500, 45) : 0

        // ── FUELING ──
        const kcal = n?.calories ?? null
        const carbs = n?.carbs != null ? Number(n.carbs) : null
        const protein = n?.protein != null ? Number(n.protein) : null
        const hadLoad = cardioRaw > 80 || strengthPts > 30

        let fuelingPenalty = 0
        // Dzień trwa — nie karzemy strain za "niedожywienie" jeszcze niezamkniętego dnia.
        if (hadLoad && !fuelingProvisional) {
          if (kcal != null) { if (kcal < 1600) fuelingPenalty += 30; else if (kcal < 2000) fuelingPenalty += 15 }
          if (isRunDay && carbs != null && carbs < 150) fuelingPenalty += 15
          if (protein != null && protein / weight < 1.6) fuelingPenalty += 10
        }

        let fuelingScore: number | null = null
        if (kcal != null) {
          const tgtKcal = hadLoad ? 2600 : 2200
          const tgtCarbs = hadLoad ? 225 : 150
          const tgtProtein = weight * 1.8
          const pPart = clamp((protein || 0) / tgtProtein, 0, 1) * 40
          const cPart = clamp((carbs || 0) / tgtCarbs, 0, 1) * 30
          const kPart = clamp(kcal / tgtKcal, 0, 1) * 30
          fuelingScore = Math.round(pPart + cPart + kPart)
        }

        // ── MENTAL LOAD (MVP: brak klasyfikatora) ──
        const mentalLoad: number | null = null
        const mentalPts = 0

        // ── STRAIN 0–21 (log-kompresja) ──
        const rawTotal = cardioRaw + strengthPts + wellnessPts + stepsLoad + fuelingPenalty + mentalPts
        const hasAnyLoad = rawTotal > 0 || z != null
        const strain = hasAnyLoad ? Math.round(21 * (1 - Math.exp(-rawTotal / 156)) * 10) / 10 : null

        // ── RECOVERY 0–100 (NOOP RecoveryScorer: HRV-dominant logistic) ──
        // Pełne wagi z PLAN_READINESS_NOOP.md 4.2: HRV 55%, RHR 20%, sleep 15%, resp 5%, skin temp 5%.
        // Z=0 → 58% (WHOOP population avg).
        let recovery: number | null = null
        const sleep = s?.total_sleep_hours ?? null
        const respToday = respByDate[date] ?? null
        const skinTempToday = skinTempByDate[date] ?? null

        // ── SLEEP DEBT (Strand SleepDebt.swift) 14-night rolling ledger ──
        // Target: 7.5h (realistic). Positive = nadwyżka snu, Negative = dług.
        const SLEEP_TARGET = 7.5
        if (sleep != null) sleepByDate[date] = Number(sleep)
        const sleepDates14 = Object.keys(sleepByDate).sort().filter(d => d <= date).slice(-14)
        const sleepDebtH = sleepDates14.length >= 4
          ? Math.round(sleepDates14.reduce((acc, d) => acc + (sleepByDate[d] - SLEEP_TARGET), 0) * 10) / 10
          : null

        // z-scores hoisted out of recovery block for VitalBands export
        const SIGMA = 1.4826 // MAD → pseudo-standard deviation
        let zHrv: number | null = null
        let zRhr: number | null = null
        let zSleepScore: number | null = null
        if (s?.sleep_score != null && sleepScoreEwma != null && sleepScoreEwma.nValid >= 4) {
          zSleepScore = (Number(s.sleep_score) - sleepScoreEwma.center) / Math.max(SIGMA * sleepScoreEwma.spread, 1e-9)
          zSleepScore = Math.round(zSleepScore * 100) / 100
        }
        if (s?.hrv_avg != null && hrvEwma != null && hrvEwma.nValid >= 4) {
          const W_HRV = 0.55, W_RHR = 0.20, W_SLEEP = 0.15, W_RESP = 0.05, W_SKIN = 0.05
          zHrv = (Number(s.hrv_avg) - hrvEwma.center) / Math.max(SIGMA * hrvEwma.spread, 1e-9)
          zRhr = s.rhr_avg != null && rhrEwma != null
            ? (rhrEwma.center - Number(s.rhr_avg)) / Math.max(SIGMA * rhrEwma.spread, 1e-9)
            : null
          const sleepPerf = sleep != null ? Number(sleep) / 8.0 : null
          const zSleep = sleepPerf != null ? (sleepPerf - 0.85) / 0.12 : null
          // Resp: wyższa wartość = gorzej (early illness signal), inwersja jak RHR
          const zResp = respToday != null && respEwma != null
            ? (respEwma.center - respToday) / Math.max(SIGMA * respEwma.spread, 1e-9)
            : null
          // Skin temp: symetryczna kara — odchylenie w którąkolwiek stronę = gorzej (4.2: skinTempScaleC=1.0)
          const zSkin = skinTempToday != null ? -Math.abs(skinTempToday) / 1.0 : null
          let zSum = zHrv * W_HRV, wSum = W_HRV
          if (zRhr != null) { zSum += zRhr * W_RHR; wSum += W_RHR }
          if (zSleep != null) { zSum += zSleep * W_SLEEP; wSum += W_SLEEP }
          if (zResp != null) { zSum += zResp * W_RESP; wSum += W_RESP }
          if (zSkin != null) { zSum += zSkin * W_SKIN; wSum += W_SKIN }
          // Logistic: K=1.6, Z0=-0.20 → Z=0 gives 58% (population average)
          const score = 100 / (1 + Math.exp(-1.6 * (zSum / wSum + 0.20)))
          recovery = clamp(Math.round(score), 0, 100)
        }
        // Cold-start fallback (< 4 valid baseline nights): use Oura readiness
        if (recovery === null && (s?.readiness_score != null || sleep != null)) {
          let rec = s?.readiness_score ?? 65
          if (sleep != null) { if (Number(sleep) < 6) rec -= 12; else if (Number(sleep) < 7) rec -= 6 }
          recovery = clamp(Math.round(rec), 0, 100)
        }

        // ── SCORE CONFIDENCE (PLAN_READINESS_NOOP.md 4.8) — szczere tiery pewności ──
        // Charge: solid wymaga w pełni zaufanego baseline (≥14 nocy), building = baseline prowizoryczny.
        const recoveryConfidence: 'calibrating' | 'building' | 'solid' =
          recovery === null ? 'calibrating'
          : (hrvEwma?.nValid ?? 0) >= 14 ? 'solid'
          : 'building'
        // Effort: solid wymaga realnych danych ze stref HR LUB zalogowanego treningu siłowego tego dnia.
        const hasZoneData = z != null && (z.z1_regen_min != null || z.z2_tlenowa_min != null || z.z3_tempo_min != null || z.z4_prog_min != null || z.z5_max_min != null)
        const strainConfidence: 'calibrating' | 'building' | 'solid' =
          strain === null ? 'calibrating'
          : (hasZoneData || wsets.length > 0) ? 'solid'
          : 'building'

        // ── STATUS ──
        let status = 'yellow'
        if ((recovery != null && recovery < 55) ||
            (strain != null && strain > 15 && recovery != null && recovery < 70) ||
            (fuelingScore != null && fuelingScore < 40 && hadLoad && !fuelingProvisional)) {
          status = 'red'
        } else if (recovery != null && recovery >= 75 && (strain == null || strain < 14)) {
          status = 'green'
        }

        // ── MAIN LIMITER ──
        // Priorytet: najpierw akcjonowalne braki paliwa w dni z obciążeniem,
        // potem węgle, dopiero potem sen (próg <6h — bo chroniczne ~6.4h
        // zagłuszałoby realny problem), na końcu koszt fizyczny / mental.
        // Gdy fueling tymczasowy (dziś) — calories/carbs NIE mogą być limiterem
        // (dzień jeszcze trwa), przepuszczamy do kolejnego w priorytecie.
        let limiter = 'recovery_ok'
        if (hadLoad && kcal != null && kcal < 1700 && !fuelingProvisional) limiter = 'calories'
        else if (isRunDay && carbs != null && carbs < 150 && !fuelingProvisional) limiter = 'carbs'
        else if (sleep != null && sleep < 6.0) limiter = 'sleep'
        else if (strain != null && strain > 15 && recovery != null && recovery < 65) {
          limiter = cardioRaw >= strengthPts ? 'cardio_load' : 'strength_load'
        }
        else if (mentalLoad != null && mentalLoad >= 7) limiter = 'mental_load'
        else if (sleep != null && sleep < 6.8) limiter = 'sleep'
        else if (kcal != null && kcal < 1500 && !fuelingProvisional) limiter = 'calories'

        // ── ILLNESS OVERRIDE — subiektywne objawy z behavior_log ──
        const illnessPenalty = illnessDates.get(date) ?? 0
        const isIll = illnessPenalty > 0
        if (isIll) {
          if (recovery != null) recovery = clamp(recovery - illnessPenalty, 0, 100)
          limiter = 'illness'
          // green → yellow, yellow/red → red
          status = status === 'green' ? 'yellow' : 'red'
        }

        // ── EXPLANATION (regułowa) ──
        const parts: string[] = []
        if (isRunDay) parts.push('bieg')
        if (strengthPts > 0) parts.push('siłownia')
        if (steps != null && steps >= 12000) parts.push(`${Math.round(steps / 1000)}k kroków`)
        if (kcal != null) parts.push(`${kcal} kcal`)
        const ctx = parts.join(' + ') || 'dzień regeneracyjny'
        const limiterPL: Record<string, string> = {
          sleep: 'głównym ograniczeniem jest sen', calories: 'za mało kalorii względem obciążenia',
          carbs: 'za mało węgli w dzień biegowy', cardio_load: 'wysoki koszt sercowo-naczyniowy',
          strength_load: 'ciężka sesja siłowa', mental_load: 'wysokie obciążenie mentalne',
          recovery_ok: 'regeneracja OK', illness: 'choroba/infekcja — ogranicz obciążenie',
        }
        const explanation = `${ctx}. Strain ${strain ?? '—'}/21, recovery ${recovery ?? '—'} — ${limiterPL[limiter]}.`
          + (isIll ? ' ⚠ choroba zalogowana.' : '')
          + (fuelingProvisional ? ' (fueling jeszcze niepełny)' : '')

        // ── READINESS LEVEL (NOOP ReadinessEngine port) ──────────────────────
        const strainByDate: Record<string, number | null> = {}
        for (const row of strainHistRunning) {
          strainByDate[row.date] = row.strain_score == null ? null : Number(row.strain_score)
        }
        strainByDate[date] = strain

        const readinessDates = new Set<string>([
          ...Object.keys(baseByDate),
          ...Object.keys(respByDate),
          ...Object.keys(strainByDate),
          date,
        ])
        const readinessDays: ReadinessDay[] = [...readinessDates]
          .filter(d => d <= date)
          .map(d => ({
            date: d,
            hrv: d === date && s?.hrv_avg != null ? Number(s.hrv_avg) : (baseByDate[d]?.hrv_avg != null ? Number(baseByDate[d].hrv_avg) : null),
            rhr: d === date && s?.rhr_avg != null ? Number(s.rhr_avg) : (baseByDate[d]?.rhr_avg != null ? Number(baseByDate[d].rhr_avg) : null),
            respRate: respByDate[d] ?? null,
            strain: strainByDate[d] ?? null,
          }))
        const readiness = computeReadiness(readinessDays, date)

        // ── CAFFEINE DECAY (4.16) half-life 5.5h; inferred from food names ──
        // Reference point: current time for today, 22:00 Warsaw for past days
        const refTs = date === todayWarsaw
          ? now.getTime()
          : new Date(date + 'T22:00:00').getTime()
        let caffeineActiveMg = 0
        for (const entry of (food[date] || [])) {
          const mg = estimateCaffeineMg(entry.name)
          if (mg === 0 || !entry.logged_at) continue
          const hoursElapsed = (refTs - new Date(entry.logged_at).getTime()) / 3600000
          if (hoursElapsed < 0 || hoursElapsed > 24) continue
          caffeineActiveMg += mg * Math.pow(0.5, hoursElapsed / 5.5)
        }
        caffeineActiveMg = Math.round(caffeineActiveMg)
        const caffeineAlert = caffeineActiveMg > 25

        // ── HYDRATION GOAL (4.16) sex baseline + effort scalar ──
        const hydrationGoalMl = (sex === 'F' ? 2700 : 3700)
          + Math.round((strain ?? 0) / 21 * 700)

        // ── FITNESS AGE (4.16 Nes 2011 waist variant) ──
        const rhrToday = s?.rhr_avg != null ? Number(s.rhr_avg) : null
        const paiProxy = steps != null ? clamp(steps / 2000, 0, 10) : 5
        const rhrC = sex === 'F' ? 0.192 : 0.155
        const paiC = sex === 'F' ? 0.186 : 0.226
        const ageC = sex === 'F' ? 0.289 : 0.296
        const fitnessAge = rhrToday != null
          ? clamp(Math.round(ageYears + (rhrC * (rhrToday - 65) - paiC * (paiProxy - 5)) / ageC), 20, 90)
          : null

        // ── VITALITY ENGINE (4.13 Gompertz: ln(2)/8 hazard doubling) ──
        // Available factors: RHR, HRV, sleep. VO2max/steps skipped (no direct source).
        const LN_HAZARD = Math.log(2) / 8  // ≈ 0.0866
        const normRHR = 60 + 0.15 * (ageYears - 25)
        const normHRV = 75 - 0.8 * (ageYears - 20)
        let vFactors = 0, nVFactors = 0
        if (rhrToday != null) { vFactors += 0.025 * (rhrToday - normRHR); nVFactors++ }
        if (s?.hrv_avg != null) { vFactors += -0.012 * (Number(s.hrv_avg) - normHRV); nVFactors++ }
        if (sleep != null) { vFactors += -0.10 * clamp(Number(sleep) - 7.0, -2.5, 1.0); nVFactors++ }
        let bodyAge: number | null = null
        let vitalityScore: number | null = null
        if (nVFactors >= 2) {
          bodyAge = clamp(Math.round(ageYears + (0.75 * vFactors) / LN_HAZARD), 20, 90)
          vitalityScore = clamp(Math.round(50 + (ageYears - bodyAge) * 2.5), 0, 100)
        }

        const row = {
          user_id: uid, date,
          strain_score: strain, recovery_score: recovery, fueling_score: fuelingScore,
          mental_load_score: mentalLoad, daily_status: status, main_limiter: limiter,
          fueling_provisional: fuelingProvisional,
          readiness_level: readiness.level,
          explanation,
          algo_version: algoVersion,
          cardio_load: Math.round(cardioRaw * 10) / 10,
          strength_load: strengthPts, leg_load: legPts, cns_load: cnsPts,
          steps_load: Math.round(stepsLoad * 10) / 10, fueling_penalty: fuelingPenalty,
          components: {
            zones: z || null, raw_total: Math.round(rawTotal * 10) / 10,
            run_rpe: maxRpe || null, pr: prBonus > 0, weight,
            kcal, carbs, protein, steps, sleep_h: sleep,
            hrv_base: hrvEwma ? Math.round(hrvEwma.center) : (hrvBase ? Math.round(hrvBase) : null),
            rhr_base: rhrEwma ? Math.round(rhrEwma.center) : (rhrBase ? Math.round(rhrBase) : null),
            hrv_ewma_nValid: hrvEwma?.nValid ?? null,
            resp_base: respEwma ? Math.round(respEwma.center * 10) / 10 : null,
            resp_today: respToday, skin_temp_dev_today: skinTempToday,
            readiness_signals: readiness.signals,
            recovery_confidence: recoveryConfidence, strain_confidence: strainConfidence,
            wellness_load: wellnessPts > 0 ? Math.round(wellnessPts * 10) / 10 : null,
            caffeine_active_mg: caffeineActiveMg > 0 ? caffeineActiveMg : null,
            caffeine_alert: caffeineAlert || null,
            hydration_goal_ml: hydrationGoalMl,
            fitness_age: fitnessAge,
            body_age: bodyAge,
            vitality_score: vitalityScore,
            sleep_debt_h: sleepDebtH,
            hrv_z: zHrv != null ? Math.round(zHrv * 100) / 100 : null,
            rhr_z: zRhr != null ? Math.round(zRhr * 100) / 100 : null,
            sleep_score_today: s?.sleep_score != null ? Number(s.sleep_score) : null,
            sleep_z: zSleepScore,
          },
          updated_at: new Date().toISOString(),
        }
        upserts.push(row)
        prev = row
        // Update running strain history for next day's ReadinessEngine
        if (strain != null) {
          strainHistRunning.push({ date, strain_score: strain })
        }
      }

      if (upserts.length) {
        const { error: upErr } = await supabase.from('daily_strain').upsert(upserts, { onConflict: 'user_id,date' })
        if (upErr) return { user_id: uid, error: upErr.message }
      }
      return { user_id: uid, days: upserts.length, latest: upserts[upserts.length - 1] }
      } catch (error: any) {
        console.error(`[strain] user ${uid} failed`, error)
        return { user_id: uid, error: error.message || String(error) }
      }
    }

    const results = await Promise.all((users || []).map(computeForUser))
    const scopedError = scopedUserId && results.length === 1 && results[0]?.error

    return new Response(JSON.stringify({ success: !scopedError, results, error: scopedError || undefined }), {
      status: scopedError ? 400 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[strain] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
