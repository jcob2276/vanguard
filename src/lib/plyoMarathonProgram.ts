/** Maraton Gdańsk 04.10.2026 — autopilot plyo przed siłownią */

export const PLYO_PROGRAM_START = '2026-06-30'

export type PlyoSlotId = 'A' | 'B' | 'C' | 'D'

export interface PlyoExercisePrescription {
  name: string
  sets: number
  /** Powtórzenia na serię (lub kontakty) */
  reps?: number
  /** Ćwiczenie na czas (np. pogo 60 s) */
  durationSec?: number
  /** Dystans w metrach (bounding) */
  distanceM?: number
  /** Wyświetlanie: „/noga” lub „/strona” */
  sideLabel?: 'noga' | 'strona'
  restSec: number
}

export interface PlyoSessionPlan {
  week: number
  phase: string
  slot: PlyoSlotId
  label: string
  deload: boolean
  taper: boolean
  sessionKey: string
  exercises: PlyoExercisePrescription[]
}

export interface PlyoProgramState {
  slotIndex: number
  sessionsCompleted: number
}

const SLOT_ORDER: PlyoSlotId[] = ['A', 'B', 'C', 'D']

const SLOT_A: PlyoExercisePrescription[] = [
  { name: 'Pogo hop', sets: 2, durationSec: 60, restSec: 60 },
  { name: 'Box jump', sets: 4, reps: 4, restSec: 90 },
  { name: 'Box step-off', sets: 3, reps: 4, restSec: 90 },
  { name: 'Single-leg hop', sets: 3, reps: 4, sideLabel: 'noga', restSec: 120 },
  { name: 'Split squat jump', sets: 3, reps: 5, sideLabel: 'noga', restSec: 90 },
]

const SLOT_B: PlyoExercisePrescription[] = [
  { name: 'Pogo hop', sets: 2, durationSec: 50, restSec: 60 },
  { name: 'Box jump lateral', sets: 3, reps: 4, sideLabel: 'strona', restSec: 90 },
  { name: 'Lateral bound', sets: 3, reps: 8, sideLabel: 'strona', restSec: 90 },
  { name: 'Single-leg box jump', sets: 3, reps: 3, sideLabel: 'noga', restSec: 120 },
  { name: 'Skater', sets: 3, reps: 10, sideLabel: 'strona', restSec: 60 },
]

const SLOT_C: PlyoExercisePrescription[] = [
  { name: 'Pogo hop', sets: 2, durationSec: 60, restSec: 60 },
  { name: 'Bounding', sets: 4, distanceM: 12, restSec: 120 },
  { name: 'Broad jump', sets: 4, reps: 3, restSec: 120 },
  { name: 'Depth jump', sets: 3, reps: 3, restSec: 150 },
  { name: 'Alternating jump lunge', sets: 3, reps: 6, sideLabel: 'noga', restSec: 90 },
]

const SLOT_D: PlyoExercisePrescription[] = [
  { name: 'Pogo hop', sets: 3, durationSec: 40, restSec: 45 },
  { name: 'Box jump', sets: 3, reps: 4, restSec: 120 },
  { name: 'Box jump continuous', sets: 4, reps: 3, restSec: 90 },
  { name: 'Pogo hop jednonóż', sets: 2, durationSec: 25, sideLabel: 'noga', restSec: 60 },
  { name: 'Tuck jump', sets: 2, reps: 4, restSec: 120 },
]

const DELOAD: PlyoExercisePrescription[] = [
  { name: 'Pogo hop', sets: 2, durationSec: 30, restSec: 60 },
  { name: 'Box jump', sets: 2, reps: 3, restSec: 90 },
  { name: 'Box step-off', sets: 2, reps: 3, restSec: 90 },
  { name: 'Single-leg hop', sets: 2, reps: 3, sideLabel: 'noga', restSec: 120 },
]

const TAPER: PlyoExercisePrescription[] = [
  { name: 'Pogo hop', sets: 2, durationSec: 30, restSec: 60 },
  { name: 'Box jump', sets: 2, reps: 2, restSec: 90 },
]

const SLOT_MAP: Record<PlyoSlotId, PlyoExercisePrescription[]> = {
  A: SLOT_A,
  B: SLOT_B,
  C: SLOT_C,
  D: SLOT_D,
}

function stateKey(userId: string) {
  return `vanguard_plyo_program_${userId}`
}

function draftKey(userId: string) {
  return `vanguard_plyo_checkoff_${userId}`
}

export function loadPlyoProgramState(userId: string): PlyoProgramState {
  try {
    const raw = localStorage.getItem(stateKey(userId))
    if (!raw) return { slotIndex: 0, sessionsCompleted: 0 }
    const p = JSON.parse(raw) as PlyoProgramState
    return {
      slotIndex: Number.isFinite(p.slotIndex) ? p.slotIndex % 4 : 0,
      sessionsCompleted: p.sessionsCompleted ?? 0,
    }
  } catch {
    return { slotIndex: 0, sessionsCompleted: 0 }
  }
}

export function savePlyoProgramState(userId: string, state: PlyoProgramState): void {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state))
  } catch { /* quota */ }
}

export function advancePlyoProgram(userId: string): void {
  const s = loadPlyoProgramState(userId)
  savePlyoProgramState(userId, {
    slotIndex: (s.slotIndex + 1) % 4,
    sessionsCompleted: s.sessionsCompleted + 1,
  })
  clearPlyoCheckoff(userId)
}

export function loadPlyoCheckoff(userId: string, sessionKey: string): boolean[][] | null {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    const p = JSON.parse(raw) as { sessionKey: string; done: boolean[][] }
    if (p.sessionKey !== sessionKey) return null
    return p.done
  } catch {
    return null
  }
}

export function savePlyoCheckoff(userId: string, sessionKey: string, done: boolean[][]): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify({ sessionKey, done }))
  } catch { /* quota */ }
}

export function clearPlyoCheckoff(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch { /* noop */ }
}

export function programWeek(today: string): number {
  const start = new Date(`${PLYO_PROGRAM_START}T12:00:00Z`)
  const d = new Date(`${today}T12:00:00Z`)
  const diff = Math.floor((d.getTime() - start.getTime()) / (7 * 86400000))
  return Math.max(1, Math.min(14, diff + 1))
}

function phaseForWeek(week: number): string {
  if (week <= 2) return 'Re-entry'
  if (week <= 5) return 'Akumulacja'
  if (week <= 8) return 'Reaktywność'
  if (week <= 10) return 'Utrzymanie'
  if (week <= 12) return 'Specyfika'
  return 'Taper'
}

function isDeloadWeek(week: number): boolean {
  return week === 4 || week === 8
}

function isTaperWeek(week: number): boolean {
  return week >= 13
}

function scalePrescription(ex: PlyoExercisePrescription, factor: number): PlyoExercisePrescription {
  const sets = Math.max(1, Math.round(ex.sets * factor))
  const durationSec = ex.durationSec ? Math.max(20, Math.round(ex.durationSec * factor)) : undefined
  const reps = ex.reps ? Math.max(2, Math.round(ex.reps * factor)) : undefined
  return { ...ex, sets, durationSec, reps }
}

function applyWeekModifiers(week: number, slot: PlyoSlotId, base: PlyoExercisePrescription[]): PlyoExercisePrescription[] {
  if (isTaperWeek(week)) return TAPER.map((e) => ({ ...e }))
  if (isDeloadWeek(week)) return DELOAD.map((e) => ({ ...e }))

  let out = base.map((e) => ({ ...e }))

  if (week <= 2) {
    out = out.map((e) => scalePrescription(e, 0.75))
    if (week === 1 && slot === 'C') {
      out = out.map((e) => (e.name === 'Depth jump' ? { ...e, name: 'Box step-off', sets: 3, reps: 4, durationSec: undefined, distanceM: undefined } : e))
    }
    if (week <= 2 && slot === 'D') {
      out = out.map((e) => (e.name === 'Tuck jump' ? { ...e, name: 'Split squat jump', sets: 2, reps: 4, sideLabel: 'noga' as const, durationSec: undefined } : e))
    }
  }

  if (week >= 11) {
    out = out.filter((e) => !['Depth jump', 'Tuck jump', 'Bounding'].includes(e.name))
    out = out.map((e) => scalePrescription(e, 0.85))
  }

  if (week === 6 && slot === 'C') {
    // depth ok at week 6+
  } else if (week < 6) {
    out = out.map((e) => (e.name === 'Depth jump' ? { name: 'Box step-off', sets: 3, reps: 4, restSec: 90 } : e))
  }

  if (week >= 12) {
    return TAPER.map((e) => ({ ...e }))
  }

  return out
}

export function formatPlyoPrescription(ex: PlyoExercisePrescription): string {
  if (ex.durationSec) {
    const side = ex.sideLabel ? ` /${ex.sideLabel}` : ''
    return `${ex.sets}×${ex.durationSec}s${side}`
  }
  if (ex.distanceM) return `${ex.sets}×${ex.distanceM} m`
  const side = ex.sideLabel ? ` /${ex.sideLabel}` : ''
  return `${ex.sets}×${ex.reps ?? '?'}${side}`
}

export function resolvePlyoSession(today: string, userId: string): PlyoSessionPlan {
  const week = programWeek(today)
  const { slotIndex } = loadPlyoProgramState(userId)
  const slot = SLOT_ORDER[slotIndex % 4]
  const deload = isDeloadWeek(week)
  const taper = isTaperWeek(week) || week >= 12
  const base = SLOT_MAP[slot]
  const exercises = applyWeekModifiers(week, slot, base)
  const phase = phaseForWeek(week)

  return {
    week,
    phase,
    slot,
    label: `Plyo · tydz. ${week} · ${slot} · ${phase}${deload ? ' · deload' : ''}${taper && week >= 13 ? ' · taper' : ''}`,
    deload,
    taper,
    sessionKey: `${week}-${slot}-${deload ? 'd' : 'n'}-${taper ? 't' : 'n'}`,
    exercises,
  }
}

export function initPlyoCheckoff(userId: string, session: PlyoSessionPlan): boolean[][] {
  const existing = loadPlyoCheckoff(userId, session.sessionKey)
  if (existing && existing.length === session.exercises.length) return existing
  const done = session.exercises.map((ex) => Array.from({ length: ex.sets }, () => false))
  savePlyoCheckoff(userId, session.sessionKey, done)
  return done
}

export function isPlyoSessionComplete(done: boolean[][]): boolean {
  return done.length > 0 && done.every((sets) => sets.length > 0 && sets.every(Boolean))
}

export function plyoPrescriptionToLogs(exercises: PlyoExercisePrescription[], done: boolean[][]): Array<{
  exercise_name: string
  set_number: number
  weight: number
  reps: number
  rir: null
  rpe: null
  is_pws_or_msp: boolean
  muscle_tags: string[]
}> {
  const logs: Array<{
    exercise_name: string
    set_number: number
    weight: number
    reps: number
    rir: null
    rpe: null
    is_pws_or_msp: boolean
    muscle_tags: string[]
  }> = []

  exercises.forEach((ex, exIdx) => {
    const setsDone = done[exIdx] ?? []
    setsDone.forEach((completed, setIdx) => {
      if (!completed) return
      let reps = ex.reps ?? 1
      if (ex.durationSec) reps = ex.durationSec
      if (ex.distanceM) reps = ex.distanceM
      logs.push({
        exercise_name: ex.name,
        set_number: setIdx + 1,
        weight: 0,
        reps,
        rir: null,
        rpe: null,
        is_pws_or_msp: false,
        muscle_tags: ['plyo'],
      })
    })
  })

  return logs
}
