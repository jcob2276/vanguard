/**
 * @function parse-workout-nl
 * @trigger HTTP POST / Frontend WorkoutQuickCapture NL parser
 * @role Parser treningów z języka naturalnego na struktury serii/powtórzeń (PL).
 * @reads exercise_logs
 * @writes —
 * @calls deepseek-chat (w workoutParseCore.ts)
 * @consumer Szybki zapis treningu w aplikacji frontendowej
 * @status active
 */
import { serveJson } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { parseWorkoutText } from '../_shared/workoutParseCore.ts'

async function loadHistoryBlock(userId: string, db: ReturnType<typeof createServiceClient>): Promise<string> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 120)
  const { data } = await db
    .from('exercise_logs')
    .select('exercise_name')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .limit(500)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const name = row.exercise_name?.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, n]) => `- ${name} (×${n})`)
    .join('\n')
}

Deno.serve(serveJson(async (req, ctx) => {
  const body = await req.json().catch(() => ({}))
  const text: string = (body.text || '').trim()
  if (!text) {
    throw new Error('Missing text')
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
  if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

  const userId = ctx.userId ?? body.userId
  const db = ctx.supabase
  const historyBlock = userId ? await loadHistoryBlock(userId, db) : ''
  const parsed = await parseWorkoutText(apiKey, text, historyBlock)

  console.log(`[parse-workout-nl] "${text.slice(0, 60)}" → ${parsed.exercises.length} ex, ${parsed.activities.length} act`)

  return parsed
}))
