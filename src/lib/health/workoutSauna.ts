import { formatWarsawDate, TIMEZONE } from '../date'
import { newExercise, newSet, type WorkoutExercise } from './workout'
import { saveWorkoutSession } from './workoutLogging'

const WELLNESS_NAMES = ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling']

function formatWarsawTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function completedSaunaWindow(minutes: number, endedAt = new Date()) {
  const startedAt = new Date(endedAt.getTime() - minutes * 60_000)
  return {
    workoutDate: formatWarsawDate(startedAt),
    startTimeManual: formatWarsawTime(startedAt),
    endTimeManual: formatWarsawTime(endedAt),
  }
}

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

function isSaunaSession(session: {
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

function sumSaunaMinutes(session: {
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

  const window = completedSaunaWindow(opts.minutes)

  await saveWorkoutSession(userId, {
    workoutName: 'Sauna',
    exercises: [exercise],
    activities: [],
    notes: opts.notes.trim(),
    sessionRpe: opts.sessionRpe,
    workoutDate: opts.workoutDate ?? window.workoutDate,
    timerStart: null,
    manualTime: true,
    startTimeManual: window.startTimeManual,
    endTimeManual: window.endTimeManual,
  })
}
