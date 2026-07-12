import { getWarsawDateString as warsaw } from '../_shared/time.ts';

const ACTIVITY_KW = /saun|rower|spacer|stretch|masaż|foam|mobility/i;

export function warsawOffsetStr(d: Date = new Date()): string {
  const utcH = d.getUTCHours()
  const warH = parseInt(d.toLocaleString('en-CA', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }), 10)
  const diff = (warH - utcH + 24) % 24
  return `+${String(diff).padStart(2, '0')}:00`
}

function fmtPace(sec: number, distM: number): string {
  if (!sec || !distM) return '—'
  const spk = sec / (distM / 1000)
  return `${Math.floor(spk / 60)}:${String(Math.round(spk % 60)).padStart(2, '0')}/km`
}

export function buildTrainingContext(workouts: any[], stravaRuns: any[]): string {
  if (workouts.length === 0 && stravaRuns.length === 0) return 'Brak treningu w tym dniu.';
  const parts: string[] = [];
  for (const w of workouts) {
    const sets = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || ''))
    const muscles = [...new Set(sets.flatMap((l: any) => l.muscle_tags || []))].join(', ')
    const topSets = Object.entries(
      sets.reduce((acc: Record<string, any[]>, l: any) => { (acc[l.exercise_name] ??= []).push(l); return acc }, {})
    ).slice(0, 5).map(([name, s]) => {
      const best = (s as Record<string, unknown>[]).reduce((b, x) => { const w = Number(x.weight) * (1 + Number(x.reps) / 30); return w > (Number(b.weight) * (1 + Number(b.reps) / 30)) ? x : b })
      return `${name} ${best.weight}kg×${best.reps}`
    }).join(', ')
    parts.push(`Siłownia [${w.workout_day}]: ${sets.length} serii${muscles ? `, partie: ${muscles}` : ''}${w.duration_minutes ? `, ${w.duration_minutes}min` : ''}${w.session_rpe ? `, RPE${w.session_rpe}` : ''}${w.msp_passed ? ', MSP ✓' : ''}\n  Ćwiczenia: ${topSets || '—'}`)
  }
  for (const r of stravaRuns) {
    const km = r.distance ? `${(r.distance / 1000).toFixed(1)}km` : '—'
    const pace = fmtPace(r.moving_time, r.distance)
    const runType = Number(r.workout_type) === 2 ? 'Długi bieg' : Number(r.workout_type) === 4 ? 'Tempo' : 'Bieg'
    parts.push(`${runType}: "${r.name}" ${km} ${pace}${r.hr_avg ? ` HR${Math.round(r.hr_avg)}` : ''}`)
  }
  return parts.join('\n')
}

export function buildTrainingDayMap(workouts: any[], stravaData: any[]): Record<string, string> {
  const trainingDayMap: Record<string, string> = {}
  for (const w of workouts) {
    const sets = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || ''))
    const muscles = [...new Set(sets.flatMap((l: any) => l.muscle_tags || []))].slice(0, 3)
    const entry = `Siłownia [${w.workout_day}] ${sets.length}s${muscles.length ? ` (${muscles.join(', ')})` : ''}`
    trainingDayMap[w.date] = trainingDayMap[w.date] ? trainingDayMap[w.date] + ' + ' + entry : entry
  }
  for (const a of stravaData) {
    if (!/run/i.test(a.sport_type || '')) continue
    const d = warsaw(new Date(a.start_date))
    const km = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '?km'
    const runType = Number(a.workout_type) === 2 ? 'Długi bieg' : Number(a.workout_type) === 3 ? 'Trening/Interwały' : 'Bieg'
    const entry = `${runType} ${km}`
    trainingDayMap[d] = trainingDayMap[d] ? trainingDayMap[d] + ' + ' + entry : entry
  }
  return trainingDayMap
}

export function buildFoodFrequency(historyData: any[]): string {
  const freq: Record<string, { count: number; total_kcal: number }> = {}
  for (const e of historyData) {
    if (!freq[e.name]) freq[e.name] = { count: 0, total_kcal: 0 }
    freq[e.name].count++
    freq[e.name].total_kcal += e.calories || 0
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 35)
    .map(([name, v]) => `${name}: ${v.count}× w 30 dniach (${Math.round(v.total_kcal)} kcal łącznie)`)
    .join('\n')
}
