import { supabase } from '../supabase'
import { scheduleStrainRecompute } from './strainRefresh'
import { invokeEdge } from '../supabase'
import { TIMEOUTS } from '../constants'
import { rpcWithOfflineFallback } from '../offlineQueue'
import { shiftDateStr } from '../date'
import {
  newActivity,
  newExercise,
  newSet,
  type WorkoutActivity,
  type WorkoutExercise,
} from './workout'

export * from './workoutDraft'

const INSIGHT_KEY = (userId: string, date: string) => `vanguard_training_insight_${userId}_${date}`

const loadTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

export async function loadWorkoutTemplate(userId: string, workoutDay?: string): Promise<import('./workoutDraft').WorkoutLoggerInitial | null> {
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

  const { exercises, activities } = logsToExercises(logs)
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
      const nextDayStr = shiftDateStr(opts.workoutDate, 1)
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

async function runTrainingLoadAnalysis(userId: string, date: string): Promise<void> {
  try {
    const json = await invokeEdge('analyze-training-load', {
      body: { userId },
      signal: AbortSignal.timeout(TIMEOUTS.llm),
    })
    const line =
      json.coach_decision_summary ||
      json.load_summary ||
      json.strength_note ||
      (json.load_status ? `Obciążenie: ${json.load_status}` : null)
    if (line) storeTrainingInsight(userId, date, String(line))
  } catch (e: unknown) { console.warn('[workoutLogging] Failed to run training load analysis:', e); }
}

/** Debounced background training insight — max ~1 heavy call after logging. */
function scheduleTrainingLoadAnalysis(userId: string, date: string): void {
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
