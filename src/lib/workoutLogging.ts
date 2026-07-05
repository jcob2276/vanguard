import { supabase } from './supabase'
import { scheduleStrainRecompute } from './strainRefresh'
import { getTodayWarsaw } from './date'
import { rpcWithOfflineFallback } from './offlineQueue'
import {
  newActivity,
  newExercise,
  newSet,
  type WorkoutActivity,
  type WorkoutExercise,
} from '../components/biometrics/workout/workoutUtils'

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
  savedAt: number
}

const DRAFT_KEY = (userId: string) => `vanguard_workout_draft_${userId}`
const ACTIVE_SESSION_KEY = (userId: string) => `vanguard_workout_session_active_${userId}`
const INSIGHT_KEY = (userId: string, date: string) => `vanguard_training_insight_${userId}_${date}`

const loadTimers = new Map<string, ReturnType<typeof setTimeout>>()

function readWorkoutDraftRaw(userId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(userId))
    if (!raw) return null
    return JSON.parse(raw) as WorkoutDraft
  } catch {
    return null
  }
}

/** Real session in progress — not an empty logger that was opened and closed. */
export function hasResumableWorkoutDraftContent(draft: WorkoutDraft): boolean {
  if (draft.workoutName?.trim()) return true
  if (draft.notes?.trim()) return true
  if (draft.sessionRpe != null) return true
  if (draft.activities?.some((a) => a.name?.trim())) return true
  if (draft.exercises?.some((e) => e.name?.trim())) return true
  if (draft.exercises?.some((e) => (e.sets ?? []).some((s) => s.kg?.trim() || s.reps?.trim()))) {
    return true
  }
  return false
}

function hasPlyoCheckoffProgress(userId: string): boolean {
  try {
    const raw = localStorage.getItem(`vanguard_plyo_checkoff_${userId}`)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { done?: boolean[][] }
    return (parsed.done ?? []).some((row) => row.some(Boolean))
  } catch {
    return false
  }
}

export function markWorkoutSessionActive(userId: string): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY(userId), String(Date.now()))
  } catch {
    /* quota */
  }
}

export function clearWorkoutSessionActive(userId: string): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY(userId))
  } catch {
    /* ignore */
  }
}

export function isWorkoutSessionActive(userId: string): boolean {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY(userId)) != null
  } catch {
    return false
  }
}

export function shouldAutoResumeWorkout(userId: string): boolean {
  const draft = readWorkoutDraftRaw(userId)
  const hasPlyo = hasPlyoCheckoffProgress(userId)
  const hasDraft = draft != null && hasResumableWorkoutDraftContent(draft)

  if (isWorkoutSessionActive(userId)) {
    if (hasDraft || hasPlyo) return true
    clearWorkoutSessionActive(userId)
    clearWorkoutDraft(userId)
    return false
  }

  if (hasDraft) return true
  if (hasPlyo) return true
  return false
}

export function purgeStaleWorkoutDraft(userId: string): void {
  if (isWorkoutSessionActive(userId)) return
  const draft = readWorkoutDraftRaw(userId)
  if (draft && !hasResumableWorkoutDraftContent(draft)) {
    clearWorkoutDraft(userId)
  }
}

export function loadWorkoutDraft(userId: string): WorkoutDraft | null {
  const parsed = readWorkoutDraftRaw(userId)
  if (!parsed) return null
  if (isWorkoutSessionActive(userId) || hasResumableWorkoutDraftContent(parsed)) {
    return parsed
  }
  clearWorkoutDraft(userId)
  return null
}

/** Persist in-progress logger state (e.g. before app backgrounds). */
export function persistWorkoutDraft(userId: string, draft: WorkoutDraft): void {
  if (isWorkoutSessionActive(userId) || hasResumableWorkoutDraftContent(draft)) {
    saveWorkoutDraft(userId, draft)
  }
}

export function endWorkoutSession(userId: string): void {
  clearWorkoutDraft(userId)
  clearWorkoutSessionActive(userId)
}

export function saveWorkoutDraft(userId: string, draft: WorkoutDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    /* quota */
  }
}

export function clearWorkoutDraft(userId: string): void {
  try {
    localStorage.removeItem(DRAFT_KEY(userId))
  } catch {
    /* ignore */
  }
}

function storeTrainingInsight(userId: string, date: string, line: string): void {
  try {
    localStorage.setItem(INSIGHT_KEY(userId, date), JSON.stringify({ line, at: Date.now() }))
  } catch {
    /* ignore */
  }
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

export type PlyoSetLog = {
  exercise_name: string
  set_number: number
  weight: number
  reps: number
  rir: null
  rpe: null
  is_pws_or_msp: boolean
  muscle_tags: string[]
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
    plyoLogs?: PlyoSetLog[]
  },
): Promise<{ queued: boolean }> {
  const validEx = opts.exercises.filter((e) => e.name.trim())
  const validAc = opts.activities.filter((a) => a.name.trim())
  const plyoLogs = opts.plyoLogs ?? []
  if (!validEx.length && !validAc.length && !plyoLogs.length) {
    throw new Error('Dodaj co najmniej jedno ćwiczenie')
  }

  const exLogs = validEx.flatMap((ex) =>
    (ex.sets ?? [])
      .filter((s) => s.kg.trim() !== '' || s.reps.trim() !== '')
      .map((s, i) => ({
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
    if (!opts.workoutDate || !opts.startTimeManual || !opts.endTimeManual) {
      throw new Error('Brakujące dane czasu manualnego (data, start lub koniec)')
    }
    const startStr = `${opts.workoutDate}T${opts.startTimeManual}:00`
    let endStr = `${opts.workoutDate}T${opts.endTimeManual}:00`

    if (opts.endTimeManual < opts.startTimeManual) {
      const dateObj = new Date(opts.workoutDate)
      dateObj.setDate(dateObj.getDate() + 1)
      const nextDayStr = dateObj.toISOString().slice(0, 10)
      endStr = `${nextDayStr}T${opts.endTimeManual}:00`
    }

    const startD = new Date(startStr)
    const endD = new Date(endStr)
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
      throw new Error('Niepoprawny format daty lub godziny')
    }
    finalStart = startD.toISOString()
    finalEnd = endD.toISOString()
  } else if (opts.timerStart) {
    finalStart = new Date(opts.timerStart).toISOString()
    finalEnd = new Date().toISOString()
  }

  const mspPassed = exLogs.some((l) => l.is_pws_or_msp)
  const dayKey =
    opts.workoutName.trim() ||
    (validEx.every((e) => (e.tags ?? []).includes('wellness')) && validEx.length > 0 ? 'Sauna' : 'Trening')

  const { queued } = await rpcWithOfflineFallback(
    'save_workout_atomic',
    {
      p_user_id: userId,
      p_day_key: dayKey,
      p_start_time: finalStart as string,
      p_end_time: finalEnd as string,
      p_notes: opts.notes,
      p_msp_passed: mspPassed,
      p_logs: [...plyoLogs, ...exLogs, ...acLogs],
      p_session_rpe: opts.sessionRpe ?? undefined,
    },
    'Trening',
  ).catch((err) => {
    throw new Error(err.message || 'Nie udało się zapisać treningu')
  })

  if (!queued) {
    scheduleTrainingLoadAnalysis(userId, opts.workoutDate)
    scheduleStrainRecompute(userId)
  }
  return { queued }
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
