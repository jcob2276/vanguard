import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import { deepseekChat } from '../_shared/deepseek.ts'

const ACTIVITY_KW = /saun|rower|spacer|stretch|masaż|foam|mobility/i

function warsaw(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
}

function warsawOffsetStr(): string {
  const d = new Date()
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
8. Jeśli nie znasz produktu — szacuj po kategorii i dostępnych makrach.
9. Nas (nasycone) wysokie + produkt zwierzęcy = dobry tłuszcz. Nas niskie + olej roślinny/uwodorniony = czerwona flaga.
10. TEF (efekt termiczny): białko spala ~30% własnych kalorii podczas trawienia, węgle ~8%, tłuszcz ~3%. 100 kcal z białka = realnie ~70 kcal netto. Uwzględniaj to w uzasadnieniach — produkty wysokobiałkowe mają realnie niższy ładunek kaloryczny niż wskazuje licznik.

KONTEKST SPORTOWY (bardzo ważny dla trafności analizy):
Analizujesz dietę maratończyka trenującego równolegle siłowo. Priorytety żywieniowe tego sportowca:
1. ŻYWIENIE TRENINGOWE — co jadł przed/po treningu? Czy miał glukozę na długi bieg, białko po siłowni?
2. MIKROSKŁADNIKI WYTRZYMAŁOŚCIOWE — żelazo (transport O2), magnez (skurcze mięśni), Vit D (kości), Omega-3 (stan zapalny). Te braki zabijają adaptację.
3. STAN ZAPALNY — chroniczny stan zapalny przy dużym km-rażu + siłownia = zahamowanie regeneracji. Ultra-przetworzona żywność vs kefir/kiszonki/ryby robi różnicę.
4. DYSTRYBUCJA BIAŁKA — 30g+ białka na posiłek = stymulacja MPS (synteza białek mięśniowych). 120g białka w jednym posiłku ≠ tyle samo co 3×40g.

Mówisz po polsku. Jesteś bezpośredni. Nie komplementujesz — diagnozujesz. Konkretne liczby zawsze.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId, date, dateFrom, dateTo } = body
    if (!userId) throw new Error('Missing userId')
    await resolveUserScope(req, userId)

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

    // ── Multi-day mode ────────────────────────────────────────────────────────
    if (dateFrom && dateTo) {
      const [entriesR, fastingR, workoutsR, stravaR] = await Promise.all([
        supabase
          .from('daily_food_entries')
          .select('date, name, brand, meal_type, calories, protein, carbs, fat, saturated_fat, sugar')
          .eq('user_id', userId)
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date')
          .order('meal_type'),
        supabase
          .from('fasting_logs')
          .select('date, note')
          .eq('user_id', userId)
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('workout_sessions')
          .select('date, workout_day, exercise_logs(exercise_name, muscle_tags)')
          .eq('user_id', userId)
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('strava_activities_clean')
          .select('start_date, sport_type, distance, workout_type')
          .eq('user_id', userId)
          .eq('is_oura', false)
          .gte('start_date', dateFrom + 'T00:00:00' + warsawOffsetStr())
          .lte('start_date', dateTo + 'T23:59:59' + warsawOffsetStr()),
      ])

      if (entriesR.error) throw new Error(`DB error (food_entries): ${entriesR.error.message}`)
      const entries = entriesR.data || []
      if (entries.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Brak wpisów żywieniowych dla tego okresu' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (fastingR.error) console.warn('[analyze-food-quality] fasting_logs error:', fastingR.error.message)
      if (workoutsR.error) console.warn('[analyze-food-quality] workout_sessions error:', workoutsR.error.message)
      if (stravaR.error)   console.warn('[analyze-food-quality] strava_activities_clean error:', stravaR.error.message)

      const fastingDays = new Map<string, string | null>(
        (fastingR.data || []).map(f => [f.date as string, (f.note as string | null) ?? null])
      )

      // Build training days map
      const trainingDayMap: Record<string, string> = {}
      for (const w of (workoutsR.data || [])) {
        const sets = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || ''))
        const muscles = [...new Set(sets.flatMap((l: any) => l.muscle_tags || []))].slice(0, 3)
        const entry = `Siłownia [${w.workout_day}] ${sets.length}s${muscles.length ? ` (${muscles.join(', ')})` : ''}`
        trainingDayMap[w.date] = trainingDayMap[w.date] ? trainingDayMap[w.date] + ' + ' + entry : entry
      }
      for (const a of (stravaR.data || [])) {
        if (!/run/i.test(a.sport_type || '')) continue
        const d = warsaw(new Date(a.start_date))
        const km = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '?km'
        const runType = Number(a.workout_type) === 2 ? 'Długi bieg' : Number(a.workout_type) === 3 ? 'Trening/Interwały' : 'Bieg'
        const entry = `${runType} ${km}`
        trainingDayMap[d] = trainingDayMap[d] ? trainingDayMap[d] + ' + ' + entry : entry
      }

      // Group by date
      const byDay: Record<string, typeof entries> = {}
      for (const e of entries) {
        if (!byDay[e.date]) byDay[e.date] = []
        byDay[e.date].push(e)
      }

      const INCOMPLETE_KCAL_THRESHOLD = 800
      const dayTotals: Record<string, number> = {}
      for (const [d, items] of Object.entries(byDay)) {
        dayTotals[d] = items.reduce((sum, e) => sum + (e.calories ?? 0), 0)
      }

      const incompleteDays = new Set(
        Object.entries(dayTotals)
          .filter(([d, kcal]) => kcal < INCOMPLETE_KCAL_THRESHOLD && !fastingDays.has(d))
          .map(([d]) => d)
      )

      const dayLines = Object.entries(byDay).map(([d, items]) => {
        const kcalTotal = dayTotals[d]
        const isFasting = fastingDays.has(d)
        const fastingNote = isFasting ? ` 🔵 POST${fastingDays.get(d) ? ` — ${fastingDays.get(d)}` : ''} (pomijaj w ocenach)` : ''
        const incompleteNote = incompleteDays.has(d) ? ` ⚠️ NIEPEŁNY DZIEŃ (${kcalTotal} kcal)` : ''
        const trainingNote = trainingDayMap[d] ? ` 🏋️ ${trainingDayMap[d]}` : ''
        const proteinTotal = items.reduce((s, e) => s + (e.protein ?? 0), 0)
        const lines = items.slice(0, 40).map(e =>
          `  - ${e.name}${e.brand ? ` (${e.brand})` : ''} | ${e.calories ?? '?'} kcal | B:${e.protein ?? '?'}g W:${e.carbs ?? '?'}g T:${e.fat ?? '?'}g${e.saturated_fat != null ? ` Nas:${e.saturated_fat}g` : ''}${e.sugar != null ? ` Cuk:${e.sugar}g` : ''}`
        ).join('\n')
        return `DZIEŃ ${d} (${items.length} pozycji, ${kcalTotal} kcal, B:${Math.round(proteinTotal)}g)${fastingNote}${incompleteNote}${trainingNote}:\n${lines}`
      }).join('\n\n')

      const fastingOnlyLines = [...fastingDays.entries()]
        .filter(([d]) => !byDay[d])
        .map(([d, note]) => `DZIEŃ ${d} (0 pozycji, 0 kcal) 🔵 POST${note ? ` — ${note}` : ''}: Świadomy post — pomiń w analizie jakości.`)
        .join('\n\n')

      const numDays = Object.keys(byDay).length + [...fastingDays.keys()].filter(d => !byDay[d]).length
      const trainingDaysCount = Object.keys(trainingDayMap).length

      const userMessage = `OKRES DO ANALIZY: ${dateFrom} → ${dateTo} (${numDays} dni, ${incompleteDays.size} niepełnych, ${fastingDays.size} postów, ${trainingDaysCount} dni treningowych)

${dayLines}${fastingOnlyLines ? '\n\n' + fastingOnlyLines : ''}

ZADANIE — zwróć JSON z dokładnie tymi polami:
- "days": tablica ${numDays} obiektów, jeden na każdy dzień z danymi: {"date":"YYYY-MM-DD","score":0-100,"summary":"1 zdanie PL"}
- "avg_score": liczba całkowita 0-100 (średnia tylko z KOMPLETNYCH dni bez postów)
- "pattern_analysis": string, 3-4 zdania PL o dominujących wzorcach (tylko kompletne dni, konkretne obserwacje z liczbami)
- "top_issues": tablica 3 krótkich fraz PL (problemy z konkretem — np. "WPC zamiast naturalnych źródeł białka 5×/tydzień")
- "strengths": tablica 3 krótkich fraz PL (mocne strony z konkretem)
- "action_steps": tablica dokładnie 3 kroków PL zaczynających się od czasownika (co zastąpić czym — max 10 słów, konkretne produkty)
- "nutrition_profile": 1-2 zdania PL — szczery opis archetypu żywieniowego (nie oceniaj, opisuj wzorzec: co dominuje, kiedy jest największy problem)
- "trend": "improving" | "stable" | "degrading" (na podstawie chronologii dni — pierwsze vs ostatnie)
- "trend_note": 1 zdanie PL — co napędza trend (konkretny wzorzec)
- "chronic_gaps": tablica max 3 PL — mikroskładniki lub kategorie żywności chroniczne brakujące (Omega-3, żelazo, warzywa, itp.)
- "best_day": "YYYY-MM-DD" (najwyższy score wśród kompletnych dni)
- "worst_day": "YYYY-MM-DD" (najniższy score wśród kompletnych dni)
- "training_nutrition_note": 1-2 zdania PL — jak odżywianie w dniach treningowych (🏋️) wyglądało vs reszta. Czy jest pre/post workout window, czy glukoza przed długim biegiem, czy białko po siłowni. Null jeśli brak dni treningowych.

WAŻNE: Odpowiedź to WYŁĄCZNIE surowy obiekt JSON, bez markdown, bez tekstu przed ani po.`

      const result = await deepseekChat({
        apiKey,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        maxTokens: 7000,
        temperature: 0.1,
        timeoutMs: 90000,
      })

      console.log('[analyze-food-quality] range raw:', result.content.slice(0, 300))

      let parsed: any = null
      const stripped = result.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const jsonCandidate = stripped.match(/\{[\s\S]*\}/)?.[0] ?? stripped

      try {
        parsed = JSON.parse(jsonCandidate)
      } catch (e) {
        const preview = result.content.slice(0, 300).replace(/\n/g, '↵')
        console.error('[analyze-food-quality] parse fail. raw preview:', preview)
        throw new Error(`Parse error — raw[0..300]: ${preview}`)
      }

      if (!parsed?.days || !Array.isArray(parsed.days)) {
        const raw = parsed as Record<string, unknown> | null
        const altDays = raw?.results || raw?.result || raw?.data || raw?.daily_analysis || raw?.analysis
        if (Array.isArray(altDays)) {
          parsed = { ...raw, days: altDays }
        } else {
          const anyArray = raw ? Object.values(raw).find(v => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === 'object' && 'date' in ((v as unknown[])[0] as object)) : null
          if (anyArray) {
            parsed = { ...raw, days: anyArray }
          } else {
            throw new Error('Nieprawidłowa struktura odpowiedzi AI')
          }
        }
      }

      parsed.days = parsed.days.map((d: Record<string, unknown>) => {
        const date = (d.date || d.data || d.day || d.dzien || d.day_date || '') as string
        const isFasting = fastingDays.has(date)
        return {
          date,
          score: isFasting ? 0 : Number(d.score ?? d.wynik ?? d.ocena ?? d.quality_score ?? d.points ?? 0),
          summary: isFasting ? (fastingDays.get(date) || 'Post') : (d.summary || d.podsumowanie || d.opis || d.comment || d.komentarz || '') as string,
          incomplete: incompleteDays.has(date),
          fasting: isFasting,
        }
      })

      const responseDates = new Set(parsed.days.map((d: { date: string }) => d.date))
      for (const [d, note] of fastingDays) {
        if (!responseDates.has(d)) {
          parsed.days.push({ date: d, score: 0, summary: note || 'Post', incomplete: false, fasting: true })
        }
      }
      parsed.days.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

      const completeDays = parsed.days.filter((d: { incomplete: boolean; fasting?: boolean }) => !d.incomplete && !d.fasting)
      if (completeDays.length > 0) {
        parsed.avg_score = Math.round(
          completeDays.reduce((sum: number, d: { score: number }) => sum + d.score, 0) / completeDays.length
        )
      }

      console.log(`[analyze-food-quality] range ${dateFrom}→${dateTo}: ${parsed.days.length} days, avg ${parsed.avg_score}`)

      return new Response(
        JSON.stringify({ success: true, mode: 'range', dateFrom, dateTo, ...parsed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Single-day mode ───────────────────────────────────────────────────────
    const targetDate = date || new Intl.DateTimeFormat('sv', {
      timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date())

    const { data: fastingLog } = await supabase
      .from('fasting_logs')
      .select('note')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .maybeSingle()

    if (fastingLog) {
      return new Response(
        JSON.stringify({
          success: true, mode: 'single', date: targetDate,
          fasting: true,
          day_quality_score: null,
          day_quality_analysis: fastingLog.note || 'Dzień świadomego postu.',
          items: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [todayEntriesR, historyR, workoutsR, stravaR] = await Promise.all([
      supabase
        .from('daily_food_entries')
        .select('id, name, brand, meal_type, calories, protein, carbs, fat, fiber, sugar, saturated_fat, amount')
        .eq('user_id', userId)
        .eq('date', targetDate)
        .order('meal_type'),
      supabase
        .from('daily_food_entries')
        .select('name, calories')
        .eq('user_id', userId)
        .gte('date', (() => { const d = new Date(targetDate + 'T12:00:00Z'); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })())
        .lt('date', targetDate),
      supabase
        .from('workout_sessions')
        .select('workout_day, duration_minutes, msp_passed, session_rpe, exercise_logs(exercise_name, set_number, weight, reps, rir, muscle_tags)')
        .eq('user_id', userId)
        .eq('date', targetDate),
      supabase
        .from('strava_activities_clean')
        .select('name, sport_type, distance, moving_time, hr_avg, workout_type')
        .eq('user_id', userId)
        .eq('is_oura', false)
        .gte('start_date', targetDate + 'T00:00:00' + warsawOffsetStr())
        .lte('start_date', targetDate + 'T23:59:59' + warsawOffsetStr()),
    ])

    const todayEntries = todayEntriesR.data
    if (!todayEntries || todayEntries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Brak wpisów żywieniowych dla tego dnia' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Training context
    const workouts = workoutsR.data || []
    const stravaRuns = (stravaR.data || []).filter((a: any) => /run/i.test(a.sport_type || ''))
    let trainingContext = 'Brak treningu w tym dniu.'
    if (workouts.length > 0 || stravaRuns.length > 0) {
      const parts: string[] = []
      for (const w of workouts) {
        const sets = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || ''))
        const muscles = [...new Set(sets.flatMap((l: any) => l.muscle_tags || []))].join(', ')
        const topSets = Object.entries(
          sets.reduce((acc: Record<string, any[]>, l: any) => { (acc[l.exercise_name] ??= []).push(l); return acc }, {})
        ).slice(0, 5).map(([name, s]) => {
          const best = (s as any[]).reduce((b, x) => { const w = Number(x.weight) * (1 + Number(x.reps) / 30); return w > (Number(b.weight) * (1 + Number(b.reps) / 30)) ? x : b })
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
      trainingContext = parts.join('\n')
    }

    // 30-day history frequency
    const freq: Record<string, { count: number; total_kcal: number }> = {}
    for (const e of (historyR.data || [])) {
      if (!freq[e.name]) freq[e.name] = { count: 0, total_kcal: 0 }
      freq[e.name].count++
      freq[e.name].total_kcal += e.calories || 0
    }
    const freqLines = Object.entries(freq)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 35)
      .map(([name, v]) => `${name}: ${v.count}× w 30 dniach (${Math.round(v.total_kcal)} kcal łącznie)`)
      .join('\n')

    // Group today by meal for protein distribution context
    const byMeal: Record<string, typeof todayEntries> = {}
    for (const e of todayEntries) {
      const m = e.meal_type || 'inne';
      (byMeal[m] ??= []).push(e)
    }
    const mealProtein = Object.entries(byMeal).map(([meal, items]) => {
      const p = items.reduce((s, e) => s + (e.protein ?? 0), 0)
      return `  ${meal}: ${Math.round(p)}g białka (${items.length} pozycji)`
    }).join('\n')

    const todayLines = todayEntries.map(e => {
      const parts = [
        `- ${e.name}${e.brand ? ` (${e.brand})` : ''}`,
        `| ${e.meal_type}`,
        `| ${e.calories} kcal`,
        `| B:${e.protein}g W:${e.carbs}g T:${e.fat}g`,
      ]
      if (e.fiber != null) parts.push(`Bl:${e.fiber}g`)
      if (e.sugar != null) parts.push(`Cuk:${e.sugar}g`)
      if (e.saturated_fat != null) parts.push(`Nas:${e.saturated_fat}g`)
      return parts.join(' ')
    }).join('\n')

    const userMessage = `DZIEŃ DO ANALIZY: ${targetDate}

TRENING W TEN DZIEŃ:
${trainingContext}

PRODUKTY DZISIAJ:
${todayLines}

BIAŁKO WEDŁUG POSIŁKÓW:
${mealProtein}

WZORZEC OSTATNICH 30 DNI (produkty, ile razy wystąpiły przed dzisiejszym dniem):
${freqLines || 'Brak danych historycznych'}

ZADANIE:
1. Oceń każdy produkt z listy PRODUKTY DZISIAJ (food_quality_score 0-100 + quality_reason po polsku, max 1 zdanie — DLACZEGO taka ocena)
2. Napisz day_quality_analysis (2-4 zdania): kontekst 30-dniowy + trening w tym dniu — czy jedzenie wspierało/hamowało wydolność i regenerację
3. Podaj day_quality_score (0-100) — przybliżona średnia ważona kalorycznie
4. protein_distribution — dla każdego meal_type ile białka i czy to stymuluje MPS (>30g = tak, 15-30g = może, <15g = nie)
5. micronutrient_gaps — max 4 braki mikroskładnikowe krytyczne dla maratończyka w tym dniu (konkretne nazwy)
6. training_sync — czy żywienie wspierało trening (pre-workout glukoza/białko, post-workout okno, w przypadku długiego biegu glikogen). Null jeśli brak treningu.
7. swap_suggestions — max 3 konkretne zamiany z listy produktów. Tylko produkty które naprawdę były dziś jedzone.

Zwróć WYŁĄCZNIE poprawny JSON bez markdown ani komentarzy:
{
  "items": [
    {"name": "dokładna nazwa z listy powyżej", "food_quality_score": 0-100, "quality_reason": "..."}
  ],
  "day_quality_score": 0-100,
  "day_quality_analysis": "...",
  "protein_distribution": [
    {"meal": "nazwa meal_type", "protein_g": liczba, "mps": true|false, "note": "1 zdanie — adekwatność do treningu"}
  ],
  "micronutrient_gaps": ["Omega-3 — brak ryb/siemienia/orzechów", "..."],
  "training_sync": "...",
  "swap_suggestions": [
    {"from": "nazwa produktu z listy", "to": "konkretny zamiennik", "reason": "1 zdanie z konkretną różnicą"}
  ]
}`

    const result = await deepseekChat({
      apiKey,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      maxTokens: 4000,
      temperature: 0.1,
      timeoutMs: 60000,
    })

    let parsed: any = null
    try {
      const match = result.content.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[analyze-food-quality] JSON parse error:', e, 'Raw:', result.content.slice(0, 500))
      throw new Error('Nie udało się sparsować odpowiedzi AI')
    }
    if (!parsed?.items || !Array.isArray(parsed.items)) throw new Error('Nieprawidłowa struktura odpowiedzi AI')

    const nameToId: Record<string, string> = {}
    for (const e of todayEntries) nameToId[e.name] = e.id

    const updatePromises = parsed.items
      .filter((item: any) => nameToId[item.name])
      .map((item: any) =>
        supabase
          .from('daily_food_entries')
          .update({ food_quality_score: item.food_quality_score, quality_reason: item.quality_reason })
          .eq('id', nameToId[item.name])
      )
    await Promise.all(updatePromises)

    await supabase
      .from('daily_nutrition')
      .upsert(
        { user_id: userId, date: targetDate, avg_food_quality: parsed.day_quality_score, food_quality_analysis: parsed.day_quality_analysis },
        { onConflict: 'user_id,date' }
      )

    console.log(`[analyze-food-quality] ${targetDate}: ${parsed.items.length} items scored, day score ${parsed.day_quality_score}`)

    return new Response(
      JSON.stringify({
        success: true, mode: 'single', date: targetDate,
        items_scored: parsed.items.length,
        day_quality_score: parsed.day_quality_score,
        day_quality_analysis: parsed.day_quality_analysis,
        items: parsed.items,
        protein_distribution: parsed.protein_distribution || [],
        micronutrient_gaps: parsed.micronutrient_gaps || [],
        training_sync: parsed.training_sync || null,
        swap_suggestions: parsed.swap_suggestions || [],
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
