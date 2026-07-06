import { deepseekChat, parseJsonFromContent } from './deepseek.ts'

interface ParsedWorkoutSet {
  kg: number
  reps: number
  rir?: number | null
  count?: number
}

interface ParsedWorkoutExercise {
  name: string
  tags?: string[]
  sets: ParsedWorkoutSet[]
  confidence: 'high' | 'medium' | 'low'
  assumptions?: string[]
}

interface ParsedWorkoutActivity {
  name: string
  minutes: number
  note?: string
}

export interface ParsedWorkout {
  workout_name?: string
  exercises: ParsedWorkoutExercise[]
  activities: ParsedWorkoutActivity[]
}

const WELLNESS_RE = /saun|lodowat|prysznic|stretch|mobility|foam/i

function parseConfidence(value: unknown): 'high' | 'medium' | 'low' {
  const v = String(value || '').toLowerCase()
  if (v === 'high' || v === 'medium' || v === 'low') return v
  return 'medium'
}

function tryRegexParse(text: string): ParsedWorkout | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 280) return null

  const activities: ParsedWorkoutActivity[] = []
  const exercises: ParsedWorkoutExercise[] = []

  const sauna = trimmed.match(/sauna\s*(\d+)\s*(?:min|m)?/i)
  if (sauna) {
    activities.push({ name: 'Sauna', minutes: parseInt(sauna[1], 10) })
  }

  const parts = trimmed.split(/[,;]+/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    if (WELLNESS_RE.test(part) && /sauna/i.test(part)) continue

    const wellnessMin = part.match(/^(lodowata|prysznic|stretch|mobility|foam roll(?:er)?)\s*(\d+)\s*(?:min|m)?/i)
    if (wellnessMin) {
      exercises.push({
        name: wellnessMin[1][0].toUpperCase() + wellnessMin[1].slice(1).toLowerCase(),
        tags: ['wellness'],
        sets: [{ kg: 0, reps: parseInt(wellnessMin[2], 10) }],
        confidence: 'high',
      })
      continue
    }

    const triple = part.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:kg|k)?\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i)
    if (triple) {
      exercises.push({
        name: triple[1].trim(),
        sets: [{
          kg: parseFloat(triple[2].replace(',', '.')),
          reps: parseInt(triple[3], 10),
          count: parseInt(triple[4], 10),
        }],
        confidence: 'high',
      })
      continue
    }

    const atKg = part.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)\s*(?:@|po)\s*(\d+(?:[.,]\d+)?)\s*(?:kg|k)?/i)
    if (atKg) {
      exercises.push({
        name: atKg[1].trim(),
        sets: [{
          kg: parseFloat(atKg[4].replace(',', '.')),
          reps: parseInt(atKg[3], 10),
          count: parseInt(atKg[2], 10),
        }],
        confidence: 'high',
      })
      continue
    }

    const seriePo = part.match(/^(.+?)\s+(\d+)\s*ser(?:ie|ii)?\s*(?:po|×|x)\s*(\d+)\s*(\d+(?:[.,]\d+)?)\s*(?:kg|k)?/i)
    if (seriePo) {
      exercises.push({
        name: seriePo[1].trim(),
        sets: [{
          kg: parseFloat(seriePo[4].replace(',', '.')),
          reps: parseInt(seriePo[3], 10),
          count: parseInt(seriePo[2], 10),
        }],
        confidence: 'medium',
        assumptions: ['domyślnie równe serie'],
      })
      continue
    }
  }

  if (!exercises.length && !activities.length) return null
  return { exercises, activities }
}

function buildSystemPrompt(historyBlock: string): string {
  return `Jesteś parserem polskich opisów treningu siłowego i wellness.
Rozbij tekst na ćwiczenia siłowe (kg, reps, serie) oraz aktywności (minuty: rower, spacer, sauna).

ZASADY:
- Pola kg/reps/serie muszą być liczbami.
- "80x5x3" = 3 serie po 5 powtórzeń na 80 kg → sets: [{kg:80,reps:5,count:3}]
- "wycisk 4x8 70kg" → sets: [{kg:70,reps:8,count:4}]
- Sauna / lodowata / stretch → tags: ["wellness"], kg=0, reps=minuty
- Rower/spacer bez kg → activities: [{name, minutes}]
- confidence: low gdy brak kg/reps lub nieznane ćwiczenie; assumptions gdy szacujesz

${historyBlock ? `CZĘSTE ĆWICZENIA UŻYTKOWNIKA:\n${historyBlock}\n` : ''}

Zwróć WYŁĄCZNIE JSON:
{"workout_name":"opcjonalnie","exercises":[{"name":"...","tags":[],"sets":[{"kg":80,"reps":5,"count":3}],"confidence":"high|medium|low","assumptions":[]}],"activities":[{"name":"...","minutes":15}]}`
}

function normalizeParsed(raw: unknown): ParsedWorkout {
  const parsed = typeof raw === 'string' ? parseJsonFromContent(raw) : raw as Record<string, unknown> | null
  if (!parsed) return { exercises: [], activities: [] }

  const exercisesRaw = Array.isArray(parsed.exercises) ? parsed.exercises : []
  const activitiesRaw = Array.isArray(parsed.activities) ? parsed.activities : []

  const exercises: ParsedWorkoutExercise[] = exercisesRaw
    .map((entry) => {
      const ex = entry as Record<string, unknown>
      const name = String(ex.name || '').trim()
      if (!name) return null
      const setsRaw = Array.isArray(ex.sets) ? ex.sets : []
      const sets: ParsedWorkoutSet[] = setsRaw.map((s) => {
        const row = s as Record<string, unknown>
        return {
          kg: Math.max(0, Number(row.kg) || 0),
          reps: Math.max(1, Math.round(Number(row.reps) || 0)),
          rir: row.rir != null ? Number(row.rir) : null,
          count: row.count != null ? Math.max(1, Math.round(Number(row.count))) : undefined,
        }
      }).filter((s) => s.reps > 0)

      if (!sets.length) return null
      const assumptions = Array.isArray(ex.assumptions)
        ? (ex.assumptions as unknown[]).map((a) => String(a).trim()).filter(Boolean)
        : undefined

      return {
        name,
        tags: Array.isArray(ex.tags) ? (ex.tags as string[]) : undefined,
        sets,
        confidence: parseConfidence(ex.confidence),
        assumptions,
      } as ParsedWorkoutExercise
    })
    .filter((e): e is ParsedWorkoutExercise => e != null)

  const activities: ParsedWorkoutActivity[] = activitiesRaw
    .map((entry) => {
      const a = entry as Record<string, unknown>
      const name = String(a.name || '').trim()
      const minutes = Math.max(1, Math.round(Number(a.minutes) || 0))
      if (!name || !minutes) return null
      return { name, minutes, note: a.note ? String(a.note) : undefined } as ParsedWorkoutActivity
    })
    .filter((a): a is ParsedWorkoutActivity => a != null)

  return {
    workout_name: parsed.workout_name ? String(parsed.workout_name) : undefined,
    exercises,
    activities,
  }
}

export async function parseWorkoutText(
  apiKey: string,
  text: string,
  historyBlock = '',
): Promise<ParsedWorkout> {
  const regex = tryRegexParse(text)
  if (regex && regex.exercises.every((e) => e.confidence !== 'low')) {
    return regex
  }

  const result = await deepseekChat({
    apiKey,
    model: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 1200,
    timeoutMs: 25000,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt(historyBlock) },
      { role: 'user', content: `Parsuj: "${text.trim()}"` },
    ],
  })

  const llm = normalizeParsed(parseJsonFromContent(result.content))
  if (llm.exercises.length || llm.activities.length) return llm
  return regex ?? { exercises: [], activities: [] }
}
