import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import { deepseekChat } from '../_shared/deepseek.ts'

const SYSTEM_PROMPT = `Jesteś dietetykiem klinicznym z podejściem "real food" — ceniącym żywność w jak najbardziej nieprzetworzonej formie. Widzisz odżywki białkowe jako przemysłowy surogat jedzenia, margarynę jako chemiczny wynalazek, a białe pieczywo jako pusty ładunek glikemiczny. Naturalne tłuszcze zwierzęce, fermentowane produkty, całe mięso, warzywa — to twoja baza.

SKALA JAKOŚCI (0–100):
85–100: Żywność pełnowartościowa, nieprzetworzona. Przykłady: wołowina, jajka, masło, łosoś, wątroba, kefir, kiszonki, orzechy, oliwa EV, kasza gryczana, warzywa, owoce.
65–84: Niskoprzeprocesowana — znane składniki, bez głównych zastrzeżeń. Przykłady: chleb na zakwasie, ryż biały, twaróg, mrożone warzywa, płatki owsiane, jogurt naturalny.
40–64: Przetworzona akceptowalnie — dodatki lub rafinowane składniki, ale nie dominują syropy/utwardzone tłuszcze. Przykłady: biały chleb, parówki dobrej jakości, makaron biały, przetwory w puszce, serek topiony, gotowe sosy na oliwie.
15–39: Wysokoprzetworzona — syrop glukozowo-fruktozowy, oleje utwardzone, aromaty, izolaty białkowe jako baza. Przykłady: odżywka białkowa WPC/WPI, słodzone napoje mleczne, słodycze, fast food, gotowe dania, słodzone napoje kawowe RTD, soki kartonowe.
0–14: Przemysłowa, bezpośrednio szkodliwa — tłuszcze trans, HFCS jako główny składnik, margaryny, frytol przemysłowy, energy drinki, napoje słodzone. Przykłady: margaryna, Coca-Cola, Red Bull, chipsy, ciastka fabryczne.

PRZYKŁADY REFERENCYJNE:
masło zwykłe → 82 | jajka całe → 92 | pierś kurczaka (plain) → 85 | wątroba wołowa → 95 | łosoś → 90
kefir pełnotłusty → 84 | twaróg półtłusty → 76 | ryż biały → 62 | chleb żytni pełnoziarnisty → 67
chleb tostowy biały → 38 | płatki owsiane → 68 | ziemniaki gotowane → 78 | kasza gryczana → 82
parówki drobiowe (Tarczyński fillet) → 45 | kiełbasa wiejska → 55 | kiełbaski wiedeńskie → 35
odżywka białkowa WPC/WPI (każda marka) → 25 | napój mleczny HP (Pilos, Lidl) → 30
latte macchiato RTD (Milbona, Pilos) → 28 | Snickers/3Bit/Milka → 12–16 | Ben&Jerry's → 12
hot dog Żabka → 14 | McDonald's (frytki, burgery, stripsy) → 18–22 | Popeyes → 22
pizza mrożona/protein → 20–25 | kebab w tortilli → 42 | skyr naturalny → 82 | skyr pitny słodzony → 55
Grycan lody śmietankowe → 38 | piwo bezalkoholowe → 28 | ser żółty naturalny → 68

ZASADY:
1. Składniki > makro. 30g białka z izolatów sojowych = niska ocena, nawet gdy makra wyglądają czysto.
2. Przetworzenie = redukcja punktów. Im więcej etapów przemysłowych, tym niżej.
3. Tłuszcze nasycone zwierzęce NIE są penalizowane — masło, śmietana, mięso dostają wysokie noty.
4. Tłuszcze trans i utwardzone — mocno obcinają wynik.
5. Cukier z owoców traktowany łagodniej niż HFCS lub cukier dodany.
6. Fermentacja, kiełkowanie = premia punktów.
7. "High protein" w nazwie nie znaczy lepsza jakość — to często marketing na izolaty.
8. Jeśli nie znasz produktu — szacuj po kategorii i dostępnych makrach.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const { userId, date } = await req.json().catch(() => ({}))
    if (!userId) throw new Error('Missing userId')
    await resolveUserScope(req, userId)

    // Default to today (Warsaw time)
    const targetDate = date || new Intl.DateTimeFormat('sv', {
      timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date())

    // 1. Fetch today's food entries
    const { data: todayEntries, error: todayErr } = await supabase
      .from('daily_food_entries')
      .select('id, name, brand, meal_type, calories, protein, carbs, fat, fiber, sugar, saturated_fat, amount')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .order('meal_type')

    if (todayErr) throw new Error(`DB error: ${todayErr.message}`)
    if (!todayEntries || todayEntries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Brak wpisów żywieniowych dla tego dnia' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch 30-day history for frequency context (exclude target date)
    const thirtyDaysAgo = new Date(targetDate + 'T12:00:00Z')
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    const { data: history } = await supabase
      .from('daily_food_entries')
      .select('name, calories')
      .eq('user_id', userId)
      .gte('date', thirtyDaysAgoStr)
      .lt('date', targetDate)

    // Build frequency map: how often each food appeared in the last 30 days
    const freq: Record<string, { count: number; total_kcal: number }> = {}
    for (const e of (history || [])) {
      if (!freq[e.name]) freq[e.name] = { count: 0, total_kcal: 0 }
      freq[e.name].count++
      freq[e.name].total_kcal += e.calories || 0
    }

    const freqLines = Object.entries(freq)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 35)
      .map(([name, v]) => `${name}: ${v.count}× w 30 dniach (${Math.round(v.total_kcal)} kcal łącznie)`)
      .join('\n')

    // 3. Build today's food list for the prompt
    const todayLines = todayEntries.map(e => {
      const parts = [
        `- ${e.name}${e.brand ? ` (${e.brand})` : ''}`,
        `| ${e.meal_type}`,
        `| ${e.calories} kcal`,
        `| B:${e.protein}g W:${e.carbs}g T:${e.fat}g`,
      ]
      if (e.fiber != null) parts.push(`Bl:${e.fiber}g`)
      if (e.sugar != null) parts.push(`Cuk:${e.sugar}g`)
      return parts.join(' ')
    }).join('\n')

    const userMessage = `DZIEŃ DO ANALIZY: ${targetDate}

PRODUKTY DZISIAJ:
${todayLines}

WZORZEC OSTATNICH 30 DNI (produkty, ile razy wystąpiły przed dzisiejszym dniem):
${freqLines || 'Brak danych historycznych'}

ZADANIE:
1. Oceń każdy produkt z listy PRODUKTY DZISIAJ (food_quality_score 0-100 + quality_reason po polsku, max 1 zdanie — wyjaśnij DLACZEGO taka ocena)
2. Napisz day_quality_analysis (2-4 zdania po polsku): uwzględnij kontekst 30-dniowy — jeden batonik to nie problem, ale codzienne parówki i napoje HP to wzorzec; skomentuj mocne i słabe strony dnia
3. Podaj day_quality_score (0-100) — przybliżona średnia ważona kalorycznie

Zwróć WYŁĄCZNIE poprawny JSON bez markdown ani komentarzy:
{
  "items": [
    {"name": "dokładna nazwa z listy powyżej", "food_quality_score": 0-100, "quality_reason": "..."},
    ...
  ],
  "day_quality_score": 0-100,
  "day_quality_analysis": "..."
}`

    // 4. Call DeepSeek
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    const result = await deepseekChat({
      apiKey,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      maxTokens: 2500,
      temperature: 0.1,
      timeoutMs: 40000,
    })

    // 5. Parse response
    let parsed: { items: Array<{ name: string; food_quality_score: number; quality_reason: string }>; day_quality_score: number; day_quality_analysis: string } | null = null
    try {
      const match = result.content.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[analyze-food-quality] JSON parse error:', e, 'Raw:', result.content.slice(0, 500))
      throw new Error('Nie udało się sparsować odpowiedzi AI')
    }
    if (!parsed?.items || !Array.isArray(parsed.items)) throw new Error('Nieprawidłowa struktura odpowiedzi AI')

    // 6. Update daily_food_entries with per-item scores
    // Match by name (case-sensitive, exact) to the entry id
    const nameToId: Record<string, string> = {}
    for (const e of todayEntries) nameToId[e.name] = e.id

    const updatePromises = parsed.items
      .filter(item => nameToId[item.name])
      .map(item =>
        supabase
          .from('daily_food_entries')
          .update({
            food_quality_score: item.food_quality_score,
            quality_reason: item.quality_reason,
          })
          .eq('id', nameToId[item.name])
      )
    await Promise.all(updatePromises)

    // 7. Upsert daily_nutrition with day-level quality summary
    await supabase
      .from('daily_nutrition')
      .upsert(
        {
          user_id: userId,
          date: targetDate,
          avg_food_quality: parsed.day_quality_score,
          food_quality_analysis: parsed.day_quality_analysis,
        },
        { onConflict: 'user_id,date' }
      )

    console.log(`[analyze-food-quality] ${targetDate}: ${parsed.items.length} items scored, day score ${parsed.day_quality_score}`)

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        items_scored: parsed.items.length,
        day_quality_score: parsed.day_quality_score,
        day_quality_analysis: parsed.day_quality_analysis,
        items: parsed.items,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[analyze-food-quality] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
