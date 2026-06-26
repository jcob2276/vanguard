/**
 * parse-workout-nl — natural-language workout parser (PL)
 *
 * POST { text, userId? }
 * → ParsedWorkout
 */
import { corsHeaders, createServiceClient, resolveUserScope } from '../_shared/supabase.ts'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const text: string = (body.text || '').trim()
    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    let userId: string | undefined
    try {
      const scope = await resolveUserScope(req, body.userId ?? null)
      userId = scope.userId ?? body.userId
    } catch {
      userId = body.userId
    }

    const db = createServiceClient()
    const historyBlock = userId ? await loadHistoryBlock(userId, db) : ''
    const parsed = await parseWorkoutText(apiKey, text, historyBlock)

    console.log(`[parse-workout-nl] "${text.slice(0, 60)}" → ${parsed.exercises.length} ex, ${parsed.activities.length} act`)

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[parse-workout-nl] error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
