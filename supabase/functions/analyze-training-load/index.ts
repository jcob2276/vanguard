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

function weekOf(date: string, now: Date, warsaw: (d: Date) => string): number {
  // returns 0 = this week (last 7 days), 1 = prev week, 2 = 2 weeks ago, 3 = 3 weeks ago
  const today = warsaw(now)
  const daysAgo = Math.floor((new Date(today + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 864e5)
  if (daysAgo < 7) return 0
  if (daysAgo < 14) return 1
  if (daysAgo < 21) return 2
  return 3
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
        .select('start_date,name,sport_type,distance,moving_time,hr_avg,hr_max,perceived_exertion,has_pr,workout_type')
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
      const saunaCount = allLogs.filter((l: any) => SAUNA_KW.test(l.exercise_name || '')).length
      const hasLongRun = runs.some((a: any) => classifyRun(a) === 'Długi bieg')
      const maxRunKm = runs.length ? Math.max(...runs.map((a: any) => (a.distance || 0) / 1000)) : 0
      return { sets, km: +km.toFixed(1), strainAvg, recovAvg, hrvAvg, sleepAvg, saunaCount, hasLongRun, maxRunKm: +maxRunKm.toFixed(1), runCount: runs.length }
    }

    const [w0, w1, w2, w3] = [0, 1, 2, 3].map(wkSummary)

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

    // ── Build prompt ──────────────────────────────────────────────────────────
    const fmtWeek = (w: ReturnType<typeof wkSummary>, label: string) =>
      `${label}: ${w.km}km bieganie (${w.runCount} biegów${w.hasLongRun ? ', w tym DŁUGI' : ', BEZ długiego'}, maks ${w.maxRunKm}km) | ${w.sets} serii siłowych | strain śr ${fmt(w.strainAvg)} | readiness śr ${fmt(w.recovAvg, 0)} | HRV śr ${fmt(w.hrvAvg, 0, 'ms')} | sen ${fmt(w.sleepAvg, 1, 'h')} | sauna ${w.saunaCount}x`

    const systemPrompt = `Jesteś trenerem przygotowującym sportowca do maratonu, który równolegle trenuje siłowo. Twoja filozofia łączy metodologię Renato Canovy (periodyzacja maratońska, specyficzność adaptacji) z podejściem Dan Johna (minimalizm siłowy, siła funkcjonalna dla sportowca wytrzymałościowego).

TWOJE PRIORYTETY — w tej kolejności:
1. BEZPIECZEŃSTWO — czy pojawiają się sygnały zbliżającej się kontuzji? (asymetria, brak higieny tkanek, overreaching)
2. SPECYFIKA MARATOŃSKA — czy bieganie buduje właściwe adaptacje? (odpowiednie strefy, długi bieg, wolumen tygodniowy)
3. PERIODYZACJA — czy widzisz plan za tymi treningami, czy chaos? Czy to tydzień deload czy przypadkowe niedociążenie?
4. CONCURRENT TRAINING BALANCE — czy siłownia i bieganie nie interferują (nogi dzień przed długim biegiem, zbyt wysoka intensywność siłownia przy dużym km-rażu)

STYL ANALIZY:
- Konkretne liczby zawsze. Nie "za mało biegania" ale "8.2km (1 bieg) vs 7.6km norma — to 1 bieg w tygodniu, nie struktura maratońska"
- Diagnozy, nie opisy. Szukaj PRZYCZYNY, nie tylko objawu.
- Specyficzne sesje w rekomendacjach: "Wtorek: 55min bieg Z2 HR < ${z2Ceiling ?? 'ok. 150'} BPM, ~6:30/km" nie "biegnij więcej"
- Jeśli tydzień wyglądał jak celowy deload (niski strain + wysoki recovery + plan mówi coś innego) — powiedz to wprost
- Flagi ryzyka kontuzji: brak ekscentrycznego treningu łydek przy rosnącym km-rażu, brak single-leg work, brak nóg przez >2 tyg, HR na biegach >88% HRmax regularnie

W polu "strength_prescription" zawsze podajesz KONKRETNĄ następną sesję siłową:
- Minimalne 5-7 ćwiczeń (nie ogólniki — konkretne ćwiczenia: wyciskanie płaskie, martwy ciąg, podciąganie, dipy, itp.)
- Każde ćwiczenie: dokładne obciążenie obliczone z e1RM (np. jeśli e1RM=97kg, seria 5 = ~86% = 83kg; seria 8 = ~80% = 77.5kg)
- Logika periodyzacji: czy intensywność/objętość po ostatniej sesji
- Jeśli brak danych e1RM dla ćwiczenia — napisz "RPE 7-8" zamiast kg

Mówisz po polsku. Jesteś bezpośredni. Nie motywujesz — analizujesz.`

    const userMsg = `PROFIL SPORTOWCA (szacunki z ostatnich 28 dni):
HRmax (maks HR widziany w danych): ${hrMax ?? '— (brak danych HR)'}
Z2 ceiling (76% HRmax): ${z2Ceiling ?? '—'} BPM | Próg tlenowy (~88% HRmax): ${thresholdHr ?? '—'} BPM

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

---
Odpowiedz WYŁĄCZNIE surowym obiektem JSON (bez markdown, bez żadnego tekstu poza JSON):
{
  "load_status": "elevated|optimal|undertrained",
  "load_summary": "1 konkretne zdanie — obciążenie tygodnia vs trend i norma, z liczbami",
  "recovery_status": "deficit|ok|surplus",
  "recovery_summary": "1 zdanie — stan regeneracji, co go napędza i co to oznacza dla następnych dni",
  "training_trajectory": "1-2 zdania — co mówi 4-tygodniowy trend? Progresja / plateau / regres / chaos? Przykład: 'Km-raż: 5→12→8→8 — brak progresji, fluktuacje wskazują na brak struktury'",
  "marathon_readiness": "1 zdanie — czy ten tydzień zbliżył do maratonu i dlaczego, z odniesieniem do planu",
  "injury_risk": {
    "level": "low|moderate|high",
    "flags": ["konkretny sygnał ryzyka z liczbami jeśli jest", "..."],
    "prevention": "1-2 zdania — co zrobić żeby zapobiec lub co wdrożyć od razu"
  },
  "strength_note": "1 zdanie — siłownia: wolumen/intensywność/progresja/integracja z bieganiem",
  "missing_muscles": ["partie których brakuje i są ważne dla maratonu — max 4, [] jeśli OK"],
  "sauna_note": "1 zdanie — sauna vs norma i dlaczego to ważne w kontekście tego tygodnia",
  "key_insights": [
    "insight 1 — najważniejszy holistyczny wniosek, zdanie z liczbami",
    "insight 2 — drugi najważniejszy",
    "insight 3 — trzeci"
  ],
  "strength_prescription": {
    "focus": "co ćwiczymy i dlaczego — np. 'Posterior chain + górna część: nogi/pośladki zadbane, czas na plec i ramiona'",
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
    { "priority": 1, "action": "konkretna akcja max 10 słów", "reason": "1 zdanie z liczbami — dlaczego" },
    { "priority": 2, "action": "...", "reason": "..." },
    { "priority": 3, "action": "...", "reason": "..." }
  ]
}`

    // ── DeepSeek API call ─────────────────────────────────────────────────────
    const result = await deepseekChat({
      apiKey,
      model: 'deepseek-chat',
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
      week_sleep: w0.sleepAvg,
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
      // 4-week trend arrays for sparkline
      km_trend: [w3.km, w2.km, w1.km, w0.km],
      sets_trend: [w3.sets, w2.sets, w1.sets, w0.sets],
      strain_trend: [w3.strainAvg, w2.strainAvg, w1.strainAvg, w0.strainAvg],
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
