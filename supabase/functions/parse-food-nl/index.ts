/**
 * parse-food-nl — natural-language meal parser with user context, reconciliation, 2-step complex meals.
 *
 * POST { text, userId? }
 * → { items: ParsedFoodItem[], meal_group_id? }
 */
import { corsHeaders, createServiceClient, resolveUserScope } from '../_shared/supabase.ts'
import {
  parseMealText,
  reconcileItems,
  applyHomemadeAdjustment,
  type UserParseContext,
} from '../_shared/foodParseCore.ts'

async function loadUserContext(userId: string, db: ReturnType<typeof createServiceClient>): Promise<UserParseContext> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 120)

  const [profileRes, targetRes, weightRes, favRes, corrRes, historyRes] = await Promise.all([
    db.from('nutrition_profile').select('height_cm, sex, birth_date').eq('user_id', userId).maybeSingle(),
    db.from('nutrition_targets').select('target_kcal, protein_floor_g').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    db.from('body_metrics').select('weight_kg').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    db.from('food_favorites').select('name, default_grams, use_count').eq('user_id', userId).order('use_count', { ascending: false }).limit(15),
    db.from('food_corrections').select('query_name, corrected_name, corrected_grams').eq('user_id', userId).order('updated_at', { ascending: false }).limit(10),
    db.from('daily_food_entries').select('name').eq('user_id', userId).gte('date', cutoff.toISOString().slice(0, 10)).limit(600),
  ])

  const profile = profileRes.data as { height_cm?: number; sex?: string; birth_date?: string } | null
  const target = targetRes.data as { target_kcal?: number; protein_floor_g?: number } | null
  const weight = weightRes.data as { weight_kg?: number } | null
  const favorites = (favRes.data ?? []) as { name: string; default_grams: number; use_count: number }[]
  const corrections = corrRes.error ? [] : ((corrRes.data ?? []) as { query_name: string; corrected_name: string | null; corrected_grams: number }[])

  const age = profile?.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000))
    : null
  const sexLabel = profile?.sex === 'female' ? 'Kobieta' : profile?.sex === 'male' ? 'Mężczyzna' : 'Użytkownik'
  const profileLine = [
    sexLabel,
    age ? `${age} lat` : null,
    profile?.height_cm ? `${profile.height_cm} cm` : null,
    weight?.weight_kg ? `waga ~${Math.round(weight.weight_kg)} kg` : null,
    target?.target_kcal ? `cel ${target.target_kcal} kcal` : null,
    target?.protein_floor_g ? `${target.protein_floor_g} g białka/d` : null,
  ].filter(Boolean).join(', ')

  const favoritesBlock = favorites.length
    ? favorites.map((f) => `- ${f.name}: zwykle ${f.default_grams}g (×${f.use_count})`).join('\n')
    : '(brak historii — użyj standardowych porcji)'

  const correctionsBlock = corrections.length
    ? corrections.map((c) => `- "${c.query_name}" → ${c.corrected_grams}g${c.corrected_name ? ` jako "${c.corrected_name}"` : ''}`).join('\n')
    : ''

  const historyNames = (historyRes.error ? [] : (historyRes.data ?? [])) as { name: string }[]
  const nameCounts = new Map<string, number>()
  for (const row of historyNames) {
    const key = row.name?.trim()
    if (!key) continue
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }
  const historyBlock = [...nameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([name, count]) => `- ${name} (×${count})`)
    .join('\n')

  return {
    profileLine: profileLine || 'Profil domyślny dorosłego użytkownika',
    targetKcal: target?.target_kcal ?? null,
    targetProtein: target?.protein_floor_g ?? null,
    favoritesBlock,
    correctionsBlock,
    historyBlock,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const text: string = (body.text || '').trim()
    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    let userId: string | undefined
    try {
      const scope = await resolveUserScope(req, body.userId ?? null)
      userId = scope.userId ?? body.userId
    } catch {
      userId = body.userId
    }

    const db = createServiceClient()
    const ctx: UserParseContext = userId
      ? await loadUserContext(userId, db)
      : {
        profileLine: 'Profil domyślny dorosłego użytkownika',
        targetKcal: null,
        targetProtein: null,
        favoritesBlock: '',
        correctionsBlock: '',
        historyBlock: '',
      }

    let items = await parseMealText(apiKey, text, ctx)

    if (supabaseUrl && serviceKey) {
      items = await reconcileItems(items, { supabaseUrl, serviceKey, userId, db })
    }

    items = applyHomemadeAdjustment(text, items)

    console.log(`[parse-food-nl] "${text.slice(0, 60)}" → ${items.length} items (user=${userId ?? 'anon'})`)

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[parse-food-nl] error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
