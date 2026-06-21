/**
 * parse-food-nl — natural-language meal parser.
 *
 * POST { text: "2 jajka ugotowane, twaróg 150g, kawa z mlekiem" }
 * → { items: [{ name, grams, calories, protein, carbs, fat }] }
 *
 * Uses DeepSeek with a curated Polish food reference so caloric values
 * match the same per-100g database as lookup-food generics.
 */
import { corsHeaders } from '../_shared/supabase.ts'
import { deepseekChat, parseJsonFromContent } from '../_shared/deepseek.ts'

// Per-100g reference so DeepSeek anchors to the same values as our generic list.
export const FOOD_REF = `Per 100g (kcal / B g / W g / T g):
jajko ugotowane: 155/13/1.1/11
kurczak pierś pieczona: 165/31/0/3.6
kurczak pierś surowa: 110/22/0/1.2
indyk pierś: 135/29/0/1
indyk mięso: 192/21.1/0.6/12.3
wieprzowina chuda: 318/16.3/0/27.9
wołowina mielona smażona: 254/26/0/17
łosoś pieczony: 208/20/0/13
tuńczyk w wodzie: 116/26/0/1
twaróg półtłusty: 137/18/3.7/5
jogurt naturalny: 61/3.5/4.7/3.3
skyr naturalny: 65/12/4/0
serek wiejski: 97/11/2/5
odżywka białkowa (WPC): 380/75/8/6
szynka z piersi kurczaka: 90/18/1/1.5
ser żółty: 350/25/2/27
ser mozzarella: 250/18/2/19
ser feta: 260/14/4/21
mleko 2%: 50/3.4/4.8/2
mleko owsiane: 45/1/7/1.5
masło: 717/0.9/0.1/81
oliwa z oliwek / olej rzepakowy: 884/0/0/100
masło orzechowe: 600/25/15/50
chleb żytni: 250/7/48/1.5
chleb pszenny: 265/9/49/3.2
płatki owsiane suche: 379/13/67/7
ryż biały suchy: 350/7/77/0.5
ryż biały gotowany: 130/2.7/28.2/0.3
kasza gryczana gotowana: 92/3.4/19.9/0.6
makaron gotowany: 131/5/25/1.1
ziemniaki gotowane: 80/2/16.5/0.3
banan: 89/1.1/22.8/0.3
jabłko: 52/0.3/13.8/0.2
truskawki: 32/0.7/7.7/0.3
brokuł gotowany: 35/2.4/7/0.4
ogórek: 15/0.7/3.6/0.1
pomidor: 18/0.9/3.9/0.2
marchew: 41/0.9/10/0.2
pieczarki: 22/3/3/0.3
cebula: 40/1.1/9/0.1
czosnek: 149/6.4/33/0.5
avocado: 160/2/9/15
orzechy nerkowca: 553/18/30/44
orzechy włoskie: 662/13.5/10.6/61.5
migdały: 643/18.3/13.4/57.9
ketchup: 100/1/22/0
majonez: 680/1/3/75
miód: 312/0.6/80.5/0
dorsz gotowany: 76/17.7/0/0.5
śledź: 248/17.3/0/19.9
pstrąg: 99/19.6/0/2.1
krewetki gotowane: 99/24/0.2/0.3
wino wytrawne: 66/0/0/0
wino półwytrawne: 78/0.3/2.5/0
wino półsłodkie: 88/0.2/5/0
wódka: 234/0/0.1/0
piwo 4.5%: 45/0.8/4.5/0
bigos: 61/4/3/4
gołąbki: 108/6/9/5.5
lazania: 132/8.5/12/5.5
gulasz wołowy: 95/12/3/4
spaghetti Bolognese: 132/7/18/3.5
ryba z frytkami: 195/9.5/22/7.5
hummus: 177/5/14/11
kebab: 215/12/18/10.5
sajgonki: 250/6/28/12.5
sałatka ziemniaczana z majonezem: 143/1.5/12/10
kotlet schabowy panierowany smażony: 270/17/8/19
kotlet mielony smażony: 250/16/5/18
pierogi ruskie gotowane: 200/6/35/4
pizza Margherita: 250/10/30/10`

export const SYSTEM = `Jesteś precyzyjnym parserem polskich opisów posiłków dla konkretnego użytkownika (Mężczyzna, ur. 2002, 168 cm wzrostu, waga ~74 kg, cel: 2084 kcal, 149g białka).
Użytkownik podaje tekstowy opis tego, co zjadł. Twoim zadaniem jest zidentyfikować poszczególne produkty, oszacować ich gramaturę (jeśli nie podano) oraz obliczyć kalorie i makroskładniki.

BAZA WARTOŚCI ODNIESIENIA (na 100g):
${FOOD_REF}

ZASADY SZACOWANIA GRAMATURY (Spersonalizowane dla profilu 168cm/74kg):
Jeśli użytkownik podaje ilość/gramaturę (np. "130 g", "50g", "2 kromki", "pół kostki") -> MASZ BEZWZGLĘDNIE UŻYĆ TEJ ILOŚCI.
Jeśli podaje "porcja", "standardowa porcja", lub nie podaje gramatury wcale, zastosuj poniższe spersonalizowane porcje domyślne dla 1 osoby:
- Mięso pieczone/smażone (karkówka, schab, kotlet) jako część obiadu: 130g - 150g (np. 1 porcja karkówki = 150g)
- Pierś z kurczaka/indyka: 130g
- Ryba pieczona: 140g
- Ziemniaki gotowane (jako dodatek): 150g (UWAGA: 150g to standardowa porcja dla tego profilu, nie 200g)
- Ryż gotowany / kasza gotowana (jako dodatek): 130g
- Makaron gotowany: 150g (jako dodatek) lub 220g (jako danie główne)
- Warzywa gotowane / surówka / sałata ze śmietaną: 120g - 150g (np. 1 porcja sałaty = 120g)
- Talerz zupy: 300g (300ml)
- Jedno jajko (rozmiar M): 55g, rozmiar L: 65g
- Jedna kromka chleba: pszenny/żytni = 35g, tostowy = 25g
- Bułka: kajzerka = 50g, grahamka = 70g
- Jedna sztuka owocu: średni banan = 100g, średnie jabłko = 150g
- Nabiał: twaróg = 100g (pół kostki = 100g, cała kostka = 200g), opakowanie skyra = 150g, serek wiejski = 200g, jogurt naturalny = 150g
- Łyżeczka masła/oliwy: 5g, łyżka masła/oliwy/masła orzechowego: 15g (łyżka masła orzechowego czubata = 20g)
- Plasterek sera żółtego = 15g, plasterek szynki = 20g
- Szklanka płynu (mleka/napoju): 250ml (250g)
- Kawa czarna lub woda/napoje zero: 0 kcal

ZASADY DOTYCZĄCE DAŃ ZŁOŻONYCH I SZACOWANIA:
- Jeśli produkt jest domowy / złożony (np. "karkówka domowa", "sałata ze śmietaną"), rozbij go na składowe lub oszacuj jako jedno entry o realistycznych wartościach:
  - "karkówka domowa": karkówka wieprzowa pieczona/duszona. Na 100g: ~250 kcal, 24g białka, 0g węglowodanów, 17g tłuszczu.
  - "sałata zielona ze śmietaną": sałata z dodatkiem śmietany 12-18%. Na 100g: ~50 kcal, 1.2g białka, 3.5g węglowodanów, 3.5g tłuszczu.
- Jeśli produkt nie znajduje się w bazie, oszacuj wartości na 100g na podstawie ogólnej wiedzy dietetycznej (np. chude ryby ~100kcal, tłuste ryby ~200kcal, słodycze ~500kcal, sosy tłuste ~300kcal).

ZASADA SUROWY VS GOTOWANY (BARDZO WAŻNE):
- Ryż, kasza, makaron, płatki owsiane i mięso drastycznie zmieniają wagę po ugotowaniu/usmażeniu.
- Jeśli użytkownik podaje wprost stan, np. "suchy ryż", "surowa pierś z kurczaka" -> używaj wartości dla produktu suchego/surowego.
- Jeśli podaje np. "ryż 150g" lub "makaron 200g" bez określenia stanu, a gramatura wskazuje na gotową porcję na talerzu (>100g) -> załóż, że to produkt gotowany (np. "ryż biały gotowany").
- Jeśli podaje małą gramaturę, np. "50g ryżu" lub "60g kaszy" (co w stanie gotowanym byłoby miniaturową porcją) -> załóż, że to masa suchego produktu przed gotowaniem i przelicz według wartości suchego produktu (np. 350 kcal/100g).

ZASADA UKRYTEGO TŁUSZCZU (BARDZO WAŻNE):
- Jeśli potrawa jest smażona (np. "jajecznica", "smażona pierś z kurczaka", "schabowy") i użytkownik nie napisał wprost "bez tłuszczu" oraz nie wyszczególnił oleju/masła:
  - Dodaj do kalkulacji tłuszcz użyty do przygotowania (np. 5g masła na każde 2 jajka w jajecznicy, 5g oleju rzepakowego na porcję mięsa). Zwróć go jako osobny produkt (np. "masło do smażenia" / "olej do smażenia") lub uwzględnij w wartościach dania głównego.

BARDZO WAŻNE REGUŁY PARSOWANIA:
1. GRAMATURA EXPLICITE JEST ŚWIĘTA. Jeśli tekst zawiera "130 g ziemniaki", gramatura ziemniaków MUSI wynosić dokładnie 130g. Nie zaokrąglaj do 150g ani 200g.
2. Zwróć każdy produkt jako osobny obiekt w tablicy. Nie sumuj posiłku w jedno entry.
3. Zweryfikuj matematykę przed wygenerowaniem wyniku! Obliczenia wartości odżywczych dla całej gramatury (grams):
   calories = (wartość_kcal_na_100g * grams) / 100 (zaokrąglone do liczby całkowitej)
   protein = (wartość_B_na_100g * grams) / 100 (zaokrąglone do 1 miejsca po przecinku)
   carbs = (wartość_W_na_100g * grams) / 100 (zaokrąglone do 1 miejsca po przecinku)
   fat = (wartość_T_na_100g * grams) / 100 (zaokrąglone do 1 miejsca po przecinku)
   fiber = błonnik w gramach dla całej porcji (zaokrąglone do 1 miejsca po przecinku). Jeśli brak informacji w bazie odniesienia, oszacuj na podstawie ogólnej wiedzy dietetycznej (np. chleb pełnoziarnisty/płatki mają ok. 6-10g błonnika/100g, owoce/warzywa mają ok. 1.5-3g błonnika/100g, mięsa/oleje mają 0g).
   sugar = cukry proste w gramach dla całej porcji (zaokrąglone do 1 miejsca po przecinku). Jeśli brak informacji w bazie odniesienia, oszacuj na podstawie ogólnej wiedzy dietetycznej (np. owoce mają ok. 5-12g cukru/100g, nabiał ma ok. 4g laktozy/100g, słodycze i miód mają wysoki cukier, mięsa/tłuszcze mają 0g).

Zwróć WYŁĄCZNIE poprawny format JSON (żadnego dodatkowego tekstu ani markdownu poza JSON):
{"items":[{"name":"dokładna nazwa produktu gotowego/potrawy","grams":130,"calories":113,"protein":2.5,"carbs":26.0,"fat":0.1,"fiber":1.8,"sugar":0.6}]}`

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

    const result = await deepseekChat({
      apiKey,
      model: 'deepseek-chat',
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 25000,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Parsuj: "${text}"` },
      ],
    })

    console.log('[parse-food-nl] raw content:', result.content?.slice(0, 300))

    const parsed = parseJsonFromContent(result.content)
    console.log('[parse-food-nl] parsed:', JSON.stringify(parsed)?.slice(0, 200))

    if (!parsed) {
      throw new Error(`AI returned no JSON. Content: ${result.content?.slice(0, 100)}`)
    }

    // Handle both {items:[...]} and flat array root
    const rawItems: unknown[] = Array.isArray(parsed.items)
      ? parsed.items as unknown[]
      : Array.isArray(parsed)
      ? parsed as unknown[]
      : []

    const items = rawItems
      .map((item: any) => ({
        name: String(item.name || '').trim(),
        grams: Math.max(1, Math.round(Number(item.grams) || 100)),
        calories: Math.max(0, Math.round(Number(item.calories) || 0)),
        protein: Math.max(0, Math.round(Number(item.protein) * 10) / 10),
        carbs: item.carbs != null ? Math.round(Number(item.carbs) * 10) / 10 : null,
        fat: item.fat != null ? Math.round(Number(item.fat) * 10) / 10 : null,
        fiber: item.fiber != null ? Math.round(Number(item.fiber) * 10) / 10 : null,
        sugar: item.sugar != null ? Math.round(Number(item.sugar) * 10) / 10 : null,
      }))
      .filter((item) => item.name && item.calories > 0)

    console.log(`[parse-food-nl] "${text.slice(0, 60)}" → ${items.length} items`)

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
