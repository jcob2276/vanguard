import type { WorkoutActivity, WorkoutExercise } from './workout'

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

function clearWorkoutSessionActive(userId: string): void {
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

function clearWorkoutDraft(userId: string): void {
  try {
    localStorage.removeItem(DRAFT_KEY(userId))
  } catch {
    /* ignore */
  }
}
