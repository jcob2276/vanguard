import { supabase } from './supabase'
import { scheduleStrainRecompute } from './strainRefresh'
import { getTodayWarsaw } from './date'
import {
  newActivity,
  newExercise,
  newSet,
  type WorkoutActivity,
  type WorkoutExercise,
} from '../components/biometrics/workout/workoutUtils'

export interface WorkoutDayChip {
  workout_day: string
  count: number
  last_date: string
}

export interface WorkoutLoggerInitial {
  workoutName: string
  exercises: WorkoutExercise[]
  activities: WorkoutActivity[]
  notes: string
  sessionRpe: number | null
}

export interface WorkoutDraft extends WorkoutLoggerInitial {
  workoutDate: string
  timerStart: number | null
  manualTime: boolean
  startTimeManual: string
  endTimeManual: string
  restDuration: number
  savedAt: number
}

export interface TodayWorkoutSession {
  id: string
  workout_day: string
  duration_minutes: number | null
  session_rpe: number | null
  hr_strain_score: number | null
  hr_avg_bpm: number | null
  volume_kg: number
  exercise_count: number
}

export interface TodayStravaActivity {
  id: string
  name: string | null
  sport_type: string | null
  distance: number | null
  moving_time: number | null
}

export interface TodayWorkoutSnapshot {
  sessions: TodayWorkoutSession[]
  strava: TodayStravaActivity[]
  totalVolumeKg: number
  strainScore: number | null
  strengthLoad: number | null
  cardioLoad: number | null
  trainingInsight: string | null
}

export interface ParsedWorkoutSet {
  kg: number
  reps: number
  rir?: number | null
}

export interface ParsedWorkoutExercise {
  name: string
  tags?: string[]
  sets: ParsedWorkoutSet[]
  confidence?: 'high' | 'medium' | 'low'
  assumptions?: string[]
}

export interface ParsedWorkoutActivity {
  name: string
  minutes: number
  note?: string
}

export interface ParsedWorkout {
  workout_name?: string
  exercises: ParsedWorkoutExercise[]
  activities?: ParsedWorkoutActivity[]
}

const DRAFT_KEY = (userId: string) => `vanguard_workout_draft_${userId}`
const INSIGHT_KEY = (userId: string, date: string) => `vanguard_training_insight_${userId}_${date}`

const loadTimers = new Map<string, ReturnType<typeof setTimeout>>()

function draftKey(userId: string) {
  return DRAFT_KEY(userId)
}

export function loadWorkoutDraft(userId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkoutDraft
    if (!parsed?.exercises?.length && !parsed?.activities?.length && !parsed.workoutName?.trim()) return null
    return parsed
  } catch {
    return null
  }
}

export function saveWorkoutDraft(userId: string, draft: WorkoutDraft): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    /* quota */
  }
}

export function clearWorkoutDraft(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch {
    /* ignore */
  }
}

export function readTrainingInsight(userId: string, date: string): string | null {
  try {
    const raw = localStorage.getItem(INSIGHT_KEY(userId, date))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { line?: string }
    return parsed.line ?? null
  } catch {
    return null
  }
}

function storeTrainingInsight(userId: string, date: string, line: string): void {
  try {
    localStorage.setItem(INSIGHT_KEY(userId, date), JSON.stringify({ line, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

export async function fetchRecentWorkoutDays(userId: string, limit = 4): Promise<WorkoutDayChip[]> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 120)
  const { data } = await supabase
    .from('workout_sessions')
    .select('workout_day, date')
    .eq('user_id', userId)
    .gte('date', cutoff.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(200)

  const map = new Map<string, { count: number; last_date: string }>()
  for (const row of data ?? []) {
    const day = row.workout_day?.trim()
    if (!day) continue
    const prev = map.get(day)
    if (!prev) map.set(day, { count: 1, last_date: row.date ?? '' })
    else map.set(day, { count: prev.count + 1, last_date: prev.last_date || row.date || '' })
  }

  return [...map.entries()]
    .map(([workout_day, v]) => ({ workout_day, count: v.count, last_date: v.last_date }))
    .sort((a, b) => b.last_date.localeCompare(a.last_date) || b.count - a.count)
    .slice(0, limit)
}

function logsToExercises(logs: Array<{
  exercise_name: string
  set_number: number
  weight: number | null
  reps: number
  rir: number | null
  is_pws_or_msp: boolean | null
  muscle_tags: string[] | null
}>): { exercises: WorkoutExercise[]; activities: WorkoutActivity[] } {
  const byName = new Map<string, typeof logs>()
  const activities: WorkoutActivity[] = []

  for (const log of logs) {
    const name = log.exercise_name.trim()
    if (!name) continue
    const tags = log.muscle_tags ?? []
    if (tags.includes('activity')) {
      const [base, note] = log.exercise_name.split(' — ')
      activities.push({
        ...newActivity(),
        name: (base ?? log.exercise_name).trim(),
        min: String(log.reps),
        note: note?.trim() ?? '',
      })
      continue
    }
    const isWellness = tags.includes('wellness')
    if (isWellness) {
      const arr = byName.get(log.exercise_name) ?? []
      arr.push(log)
      byName.set(log.exercise_name, arr)
      continue
    }
    const arr = byName.get(name) ?? []
    arr.push(log)
    byName.set(name, arr)
  }

  const exercises: WorkoutExercise[] = []
  for (const [name, sets] of byName) {
    const sorted = [...sets].sort((a, b) => a.set_number - b.set_number)
    const tags = sorted[0]?.muscle_tags ?? []
    exercises.push({
      ...newExercise(),
      name,
      tags: tags.filter(Boolean),
      sets: sorted.map((s) => ({
        ...newSet(),
        kg: s.weight != null ? String(s.weight) : '',
        reps: String(s.reps),
        rir: s.rir != null ? String(s.rir) : '',
        msp: s.is_pws_or_msp === true,
        done: false,
      })),
    })
  }

  return { exercises, activities }
}

export async function loadWorkoutTemplate(userId: string, workoutDay?: string): Promise<WorkoutLoggerInitial | null> {
  let query = supabase
    .from('workout_sessions')
    .select('id, workout_day, session_notes, session_rpe')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)

  if (workoutDay?.trim()) {
    query = supabase
      .from('workout_sessions')
      .select('id, workout_day, session_notes, session_rpe')
      .eq('user_id', userId)
      .eq('workout_day', workoutDay.trim())
      .order('date', { ascending: false })
      .limit(1)
  }

  const { data: sessions } = await query
  const session = sessions?.[0]
  if (!session) return null

  const { data: logs } = await supabase
    .from('exercise_logs')
    .select('exercise_name, set_number, weight, reps, rir, is_pws_or_msp, muscle_tags')
    .eq('user_id', userId)
    .eq('session_id', session.id)
    .order('set_number', { ascending: true })

  if (!logs?.length) return null

  const { exercises, activities } = logsToExercises(logs as any)
  return {
    workoutName: session.workout_day ?? '',
    exercises: exercises.length ? exercises : [newExercise()],
    activities,
    notes: session.session_notes ?? '',
    sessionRpe: session.session_rpe ?? null,
  }
}

export function computeVolumeKg(exercises: WorkoutExercise[]): number {
  return exercises.reduce((sum, ex) => {
    if ((ex.tags ?? []).includes('wellness')) return sum
    return sum + (ex.sets ?? []).reduce((s, set) => s + (parseFloat(set.kg) || 0) * (parseInt(set.reps, 10) || 0), 0)
  }, 0)
}

export function needsWorkoutReview(parsed: ParsedWorkout): boolean {
  return parsed.exercises.some((e) => (e.confidence ?? 'medium') === 'low')
}

export function parsedToLoggerState(parsed: ParsedWorkout): WorkoutLoggerInitial {
  const exercises: WorkoutExercise[] = parsed.exercises.map((ex) => {
    const sets = ex.sets.flatMap((s) => {
      const count = Math.max(1, (s as any).count ?? 1)
      return Array.from({ length: count }, () => ({
        ...newSet(),
        kg: String(s.kg),
        reps: String(s.reps),
        rir: s.rir != null ? String(s.rir) : '',
      }))
    })
    return {
      ...newExercise(),
      name: ex.name,
      tags: ex.tags ?? [],
      sets: sets.length ? sets : [newSet()],
    }
  })

  const activities = (parsed.activities ?? []).map((a) => ({
    ...newActivity(),
    name: a.name,
    min: String(a.minutes),
    note: a.note ?? '',
  }))

  return {
    workoutName: parsed.workout_name?.trim() ?? '',
    exercises: exercises.length ? exercises : [newExercise()],
    activities,
    notes: '',
    sessionRpe: null,
  }
}

export async function parseWorkoutNL(text: string, userId: string, accessToken: string): Promise<ParsedWorkout> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-workout-nl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.trim(), userId }),
    signal: AbortSignal.timeout(35000),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json as ParsedWorkout
}

export async function saveWorkoutSession(
  userId: string,
  opts: {
    workoutName: string
    exercises: WorkoutExercise[]
    activities: WorkoutActivity[]
    notes: string
    sessionRpe: number | null
    workoutDate: string
    timerStart: number | null
    manualTime: boolean
    startTimeManual: string
    endTimeManual: string
  },
): Promise<void> {
  const validEx = opts.exercises.filter((e) => e.name.trim())
  const validAc = opts.activities.filter((a) => a.name.trim())
  if (!validEx.length && !validAc.length) throw new Error('Dodaj co najmniej jedno ćwiczenie')

  const exLogs = validEx.flatMap((ex) =>
    (ex.sets ?? []).map((s, i) => ({
      exercise_name: ex.name.trim(),
      set_number: i + 1,
      weight: parseFloat(s.kg) || 0,
      reps: parseInt(s.reps, 10) || 0,
      rir: s.rir !== '' ? parseFloat(s.rir) : null,
      rpe: null,
      is_pws_or_msp: s.msp === true,
      muscle_tags: ex.tags ?? [],
    })),
  )

  const acLogs = validAc.map((a, i) => ({
    exercise_name: a.note.trim() ? `${a.name.trim()} — ${a.note.trim()}` : a.name.trim(),
    set_number: i + 1,
    weight: 0,
    reps: parseInt(a.min, 10) || 0,
    rpe: null,
    rir: null,
    muscle_tags: ['activity'],
  }))

  let finalStart: string | null = null
  let finalEnd: string | null = null

  if (opts.manualTime) {
    finalStart = new Date(`${opts.workoutDate}T${opts.startTimeManual}:00`).toISOString()
    finalEnd = new Date(`${opts.workoutDate}T${opts.endTimeManual}:00`).toISOString()
  } else if (opts.timerStart) {
    finalStart = new Date(opts.timerStart).toISOString()
    finalEnd = new Date().toISOString()
  }

  const mspPassed = exLogs.some((l) => l.is_pws_or_msp)
  const dayKey =
    opts.workoutName.trim() ||
    (validEx.every((e) => (e.tags ?? []).includes('wellness')) && validEx.length > 0 ? 'Sauna' : 'Trening')

  const { error } = await supabase.rpc('save_workout_atomic', {
    p_user_id: userId,
    p_day_key: dayKey,
    p_start_time: finalStart as string,
    p_end_time: finalEnd as string,
    p_notes: opts.notes,
    p_msp_passed: mspPassed,
    p_logs: [...exLogs, ...acLogs],
    p_session_rpe: opts.sessionRpe ?? undefined,
  })
  if (error) throw new Error(error.message || 'Nie udało się zapisać treningu')

  scheduleTrainingLoadAnalysis(userId, opts.workoutDate)
  scheduleStrainRecompute(userId)
}

const WELLNESS_NAMES = ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling']

export function isWellnessOnlySession(session: {
  workout_day?: string | null
  exercise_logs?: Array<{ exercise_name?: string | null; muscle_tags?: string[] | null }> | null
}): boolean {
  const logs = session.exercise_logs ?? []
  if (!logs.length) {
    return WELLNESS_NAMES.includes((session.workout_day || '').toLowerCase())
  }
  return logs.every((l) => (l.muscle_tags ?? []).includes('wellness'))
}

export function sessionDateKey(date: string | null | undefined): string {
  if (!date) return ''
  return date.slice(0, 10)
}

export function isSaunaSession(session: {
  workout_day?: string | null
  exercise_logs?: Array<{ exercise_name?: string | null; muscle_tags?: string[] | null; reps?: number | null }> | null
}): boolean {
  const logs = session.exercise_logs ?? []
  if (logs.some((l) => (l.exercise_name || '').toLowerCase().includes('sauna'))) return true
  const day = (session.workout_day || '').toLowerCase()
  if (day.includes('sauna')) return true
  return logs.some(
    (l) =>
      (l.muscle_tags ?? []).includes('wellness') &&
      WELLNESS_NAMES.some((w) => (l.exercise_name || '').toLowerCase().startsWith(w) && w === 'sauna'),
  )
}

export function sumSaunaMinutes(session: {
  exercise_logs?: Array<{ exercise_name?: string | null; reps?: number | null }> | null
}): number {
  return (session.exercise_logs ?? [])
    .filter((l) => (l.exercise_name || '').toLowerCase().includes('sauna'))
    .reduce((sum, l) => sum + (Number(l.reps) || 0), 0)
}

export function getSaunaStats(
  sessions: Array<{
    date: string
    workout_day?: string | null
    exercise_logs?: Array<{ exercise_name?: string | null; muscle_tags?: string[] | null; reps?: number | null }> | null
  }>,
  sinceDate: string,
) {
  const recent = sessions.filter(
    (s) => sessionDateKey(s.date) >= sinceDate && isSaunaSession(s),
  )
  const sessionsCount = recent.length
  const totalMinutes = recent.reduce((sum, s) => sum + sumSaunaMinutes(s), 0)
  return { sessionsCount, totalMinutes }
}

export interface TodaySaunaEntry {
  id: string
  minutes: number
  celsius: number | null
  sessionRpe: number | null
  notes: string | null
}

export async function fetchTodaySaunaEntries(userId: string, date = getTodayWarsaw()): Promise<TodaySaunaEntry[]> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, session_rpe, session_notes, workout_day, exercise_logs(exercise_name, reps, weight, muscle_tags)')
    .eq('user_id', userId)
    .eq('date', date)
    .order('start_time', { ascending: true })

  return (sessions ?? [])
    .filter((s) => isSaunaSession(s))
    .map((s) => {
      const log = (s.exercise_logs ?? []).find((l) => (l.exercise_name || '').toLowerCase().includes('sauna'))
        ?? (s.exercise_logs ?? [])[0]
      return {
        id: s.id,
        minutes: Number(log?.reps) || 0,
        celsius: Number(log?.weight) > 0 ? Number(log?.weight) : null,
        sessionRpe: s.session_rpe,
        notes: s.session_notes,
      }
    })
}

export async function saveSaunaSession(
  userId: string,
  opts: {
    minutes: number
    celsius: number | null
    sessionRpe: number | null
    notes: string
    workoutDate?: string
  },
): Promise<void> {
  if (!opts.minutes || opts.minutes < 1) throw new Error('Podaj czas w minutach')

  const exercise: WorkoutExercise = {
    ...newExercise(),
    name: 'Sauna',
    tags: ['wellness'],
    sets: [
      {
        ...newSet(),
        reps: String(opts.minutes),
        kg: opts.celsius != null && opts.celsius > 0 ? String(Math.round(opts.celsius)) : '',
        done: true,
      },
    ],
  }

  await saveWorkoutSession(userId, {
    workoutName: 'Sauna',
    exercises: [exercise],
    activities: [],
    notes: opts.notes.trim(),
    sessionRpe: opts.sessionRpe,
    workoutDate: opts.workoutDate ?? getTodayWarsaw(),
    timerStart: null,
    manualTime: false,
    startTimeManual: '',
    endTimeManual: '',
  })
}

export async function deleteSaunaSession(userId: string, sessionId: string): Promise<void> {
  await supabase.from('exercise_logs').delete().eq('session_id', sessionId).eq('user_id', userId)
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId).eq('user_id', userId)
  if (error) throw error
}

export async function fetchTodayWorkoutSnapshot(userId: string, date = getTodayWarsaw()): Promise<TodayWorkoutSnapshot> {
  const [{ data: sessions }, { data: strain }, { data: strava }] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id, workout_day, duration_minutes, session_rpe, hr_strain_score, hr_avg_bpm')
      .eq('user_id', userId)
      .eq('date', date)
      .order('start_time', { ascending: true }),
    supabase
      .from('daily_strain')
      .select('strain_score, strength_load, cardio_load')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('strava_activities_clean')
      .select('id, name, sport_type, distance, moving_time')
      .eq('user_id', userId)
      .gte('start_date', `${date}T00:00:00`)
      .lte('start_date', `${date}T23:59:59`)
      .order('start_date', { ascending: false }),
  ])

  const sessionIds = (sessions ?? []).map((s) => s.id)
  let volumeBySession: Record<string, number> = {}
  let countBySession: Record<string, number> = {}

  if (sessionIds.length) {
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('session_id, weight, reps, muscle_tags')
      .eq('user_id', userId)
      .in('session_id', sessionIds)

    for (const log of logs ?? []) {
      if ((log.muscle_tags ?? []).includes('wellness')) continue
      const vol = (Number(log.weight) || 0) * (Number(log.reps) || 0)
      volumeBySession[log.session_id!] = (volumeBySession[log.session_id!] ?? 0) + vol
      countBySession[log.session_id!] = (countBySession[log.session_id!] ?? 0) + 1
    }
  }

  const mappedSessions: TodayWorkoutSession[] = (sessions ?? [])
    .filter((s) => (s.workout_day || '').toLowerCase() !== 'sauna')
    .map((s) => ({
    id: s.id,
    workout_day: s.workout_day,
    duration_minutes: s.duration_minutes,
    session_rpe: s.session_rpe,
    hr_strain_score: s.hr_strain_score,
    hr_avg_bpm: s.hr_avg_bpm,
    volume_kg: Math.round(volumeBySession[s.id] ?? 0),
    exercise_count: countBySession[s.id] ?? 0,
  }))

  return {
    sessions: mappedSessions,
    strava: (strava ?? []) as TodayStravaActivity[],
    totalVolumeKg: mappedSessions.reduce((s, x) => s + x.volume_kg, 0),
    strainScore: strain?.strain_score ?? null,
    strengthLoad: strain?.strength_load ?? null,
    cardioLoad: strain?.cardio_load ?? null,
    trainingInsight: readTrainingInsight(userId, date),
  }
}

async function runTrainingLoadAnalysis(userId: string, date: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-training-load`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(90000),
    })
    const json = await res.json()
    if (!res.ok) return
    const line =
      json.coach_decision_summary ||
      json.load_summary ||
      json.strength_note ||
      (json.load_status ? `Obciążenie: ${json.load_status}` : null)
    if (line) storeTrainingInsight(userId, date, String(line))
  } catch (e) {
    console.warn('[workoutLogging] analyze-training-load failed', e)
  }
}

/** Debounced background training insight — max ~1 heavy call after logging. */
export function scheduleTrainingLoadAnalysis(userId: string, date: string): void {
  const key = `${userId}:${date}`
  const existing = loadTimers.get(key)
  if (existing) clearTimeout(existing)
  loadTimers.set(
    key,
    setTimeout(() => {
      loadTimers.delete(key)
      void runTrainingLoadAnalysis(userId, date)
    }, 4000),
  )
}
