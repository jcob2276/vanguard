import { deepseekChat, parseJsonFromContent } from './deepseek.ts'

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

export interface ParsedFoodItem {
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  confidence: 'high' | 'medium' | 'low'
  source: 'llm' | 'database' | 'library'
  assumptions?: string[]
}

export interface UserParseContext {
  profileLine: string
  targetKcal: number | null
  targetProtein: number | null
  favoritesBlock: string
  correctionsBlock: string
  historyBlock: string
}

interface Per100gFood {
  name: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber?: number | null
  sugar?: number | null
}

const COMPLEX_MEAL_RE = /\b(obiad|restaurac|u mamy|potrawa domow|karkowka domow|bigos domow)\b/i

/** Waga 1 szt. — do przeliczania "4 naleśniki" → grams łącznie. */
const PIECE_GRAMS_RULES: Array<{ test: (n: string) => boolean; grams: number; label: string }> = [
  { test: (n) => /nalesnik|placek|racuch/.test(n), grams: 75, label: 'naleśnik/placki' },
  { test: (n) => /\bjaj/.test(n), grams: 60, label: 'jajko' },
  { test: (n) => /pierog/.test(n), grams: 55, label: 'pieróg' },
  { test: (n) => /kromk/.test(n), grams: 35, label: 'kromka chleba' },
  { test: (n) => /\bbul/.test(n), grams: 55, label: 'bułka' },
  { test: (n) => /plaster/.test(n), grams: 18, label: 'plasterek' },
]

export function pieceGramsForName(name: string): number | null {
  const n = normalizePl(name)
  for (const rule of PIECE_GRAMS_RULES) {
    if (rule.test(n)) return rule.grams
  }
  return null
}

/** "4 naleśniki", "3 jajka", "2x pieróg" → liczba sztuk z tekstu użytkownika. */
export function parseDeclaredPieceCount(text: string): number | null {
  const n = normalizePl(text)
  const m = n.match(
    /\b(\d{1,2})\s*(?:x\s*)?(?:szt\.?\s*)?(?:nalesnik\w*|placek\w*|racuch\w*|jaj\w*|pierog\w*|kromk\w*|bul\w*|plaster\w*)/,
  )
  if (!m) return null
  const count = parseInt(m[1], 10)
  return count >= 2 && count <= 24 ? count : null
}

function scaleParsedItem(item: ParsedFoodItem, factor: number): ParsedFoodItem {
  if (factor <= 0 || !Number.isFinite(factor) || Math.abs(factor - 1) < 0.04) return item
  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    ...item,
    grams: Math.max(1, Math.round(item.grams * factor)),
    calories: Math.max(0, Math.round(item.calories * factor)),
    protein: round1(item.protein * factor),
    carbs: round1(item.carbs * factor),
    fat: round1(item.fat * factor),
    fiber: item.fiber != null ? round1(item.fiber * factor) : undefined,
    sugar: item.sugar != null ? round1(item.sugar * factor) : undefined,
  }
}

/** Jeśli user napisał "4 naleśniki", a LLM zwrócił porcję na ~1–2 szt. — skaluj w górę. */
export function applyDeclaredPieceCount(text: string, items: ParsedFoodItem[]): ParsedFoodItem[] {
  const count = parseDeclaredPieceCount(text)
  if (!count || items.length !== 1) return items

  const perPiece =
    pieceGramsForName(items[0].name) ??
    pieceGramsForName(text)
  if (!perPiece) return items

  const targetGrams = count * perPiece
  const item = items[0]
  const assumption = `${count} szt. × ~${perPiece}g ≈ ${targetGrams}g łącznie`

  if (item.grams < targetGrams * 0.85) {
    const factor = targetGrams / item.grams
    const scaled = scaleParsedItem(item, factor)
    return [{
      ...scaled,
      confidence: item.confidence === 'high' ? 'medium' : item.confidence,
      assumptions: [...(item.assumptions ?? []), assumption],
    }]
  }

  if (item.grams <= targetGrams * 1.25) {
    return [{
      ...item,
      assumptions: [...(item.assumptions ?? []), assumption],
    }]
  }

  return items
}

export function isHomemadeContext(text: string): boolean {
  const n = normalizePl(text)
  return /\b(domow\w*|wlasn\w*|babci|babcia|mamy|tesciow\w*|gotowane w domu)\b/.test(n)
}

/** Domowe ≈ mniej cukru/tłuszczu niż paczka/restauracja — skromna korekta, z assumption. */
export function applyHomemadeAdjustment(text: string, items: ParsedFoodItem[]): ParsedFoodItem[] {
  if (!isHomemadeContext(text)) return items

  return items.map((item) => {
    const sugarBefore = item.sugar ?? 0
    const fatBefore = item.fat
    const sugar = item.sugar != null ? Math.round(item.sugar * 0.88 * 10) / 10 : undefined
    const fat = Math.round(item.fat * 0.92 * 10) / 10
    const sugarSaved = item.sugar != null ? (sugarBefore - (sugar ?? 0)) * 4 : 0
    const fatSaved = (fatBefore - fat) * 9
    const calories = Math.max(0, Math.round(item.calories - sugarSaved - fatSaved))
    return {
      ...item,
      sugar,
      fat,
      calories,
      assumptions: [
        ...(item.assumptions ?? []),
        'domowe — lekko niższy cukier/tłuszcz niż wersja sklepowa/restauracyjna',
      ],
    }
  })
}

export function normalizePl(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź|ż/g, 'z')
}

export function isComplexMeal(text: string): boolean {
  if (text.length > 120) return true
  if (COMPLEX_MEAL_RE.test(text)) return true
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length >= 4
}

function portionRulesBlock(): string {
  return `ZASADY SZACOWANIA GRAMATURY (Spersonalizowane dla profilu użytkownika):
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
- Ptasie mleczko (1 szt.): 13g
- Ciastko kruche / herbatnik (1 szt.): 10g
- Kostka czekolady (1 szt.): 5g
- Żelka / cukierek (1 szt.): 5g
- Naleśnik / placki z nadzieniem (1 szt., domowe): 70-85g (średnio 75g). "4 naleśniki" → JEDNO entry, grams = 4 × 75g = 300g (nie 4 osobne wpisy, nie 75g).
- Pieróg (1 szt.): 55g. "6 pierogów" → grams = 330g.
- Gdy użytkownik podaje liczbę sztuk przed produktem (np. "4 naleśniki", "3 jajka") — ZMNOŻ wagę 1 sztuki przez liczbę w polu grams.`
}

function complexDishRulesBlock(): string {
  return `ZASADY DOTYCZĄCE DAŃ ZŁOŻONYCH I SZACOWANIA:
- "domowe", "od babci", "własne" przy pojedynczym produkcie (np. naleśniki, pierogi) = jedno entry, realistyczna gramatura × liczba sztuk; lekko niższy cukier/tłuszcz niż wersja sklepowa (mniej cukru w cieście, bez frytki głębokiej).
- Jeśli produkt jest domowy / złożony (np. "karkówka domowa", "sałata ze śmietaną"), rozbij go na składowe lub oszacuj jako jedno entry o realistycznych wartościach:
  - "karkówka domowa": karkówka wieprzowa pieczona/duszona. Na 100g: ~250 kcal, 24g białka, 0g węglowodanów, 17g tłuszczu.
  - "sałata zielona ze śmietaną": sałata z dodatkiem śmietany 12-18%. Na 100g: ~50 kcal, 1.2g białka, 3.5g węglowodanów, 3.5g tłuszczu.
- Jeśli produkt nie znajduje się w bazie, oszacuj wartości na 100g na podstawie ogólnej wiedzy dietetycznej (np. chude ryby ~100kcal, tłuste ryby ~200kcal, słodycze ~500kcal, sosy tłuste ~300kcal).`
}

function rawVsCookedBlock(): string {
  return `ZASADA SUROWY VS GOTOWANY (BARDZO WAŻNE):
- Ryż, kasza, makaron, płatki owsiane i mięso drastycznie zmieniają wagę po ugotowaniu/usmażeniu.
- Jeśli użytkownik podaje wprost stan, np. "suchy ryż", "surowa pierś z kurczaka" -> używaj wartości dla produktu suchego/surowego.
- Jeśli podaje np. "ryż 150g" lub "makaron 200g" bez określenia stanu, a gramatura wskazuje na gotową porcję na talerzu (>100g) -> załóż, że to produkt gotowany (np. "ryż biały gotowany").
- Jeśli podaje małą gramaturę, np. "50g ryżu" lub "60g kaszy" (co w stanie gotowanym byłoby miniaturową porcją) -> załóż, że to masa suchego produktu przed gotowaniem i przelicz według wartości suchego produktu (np. 350 kcal/100g).`
}

function hiddenFatBlock(): string {
  return `ZASADA UKRYTEGO TŁUSZCZU (BARDZO WAŻNE):
- Jeśli potrawa jest smażona (np. "jajecznica", "smażona pierś z kurczaka", "schabowy") i użytkownik nie napisał wprost "bez tłuszczu" oraz nie wyszczególnił oleju/masła:
  - Dodaj do kalkulacji tłuszcz użyty do przygotowania (np. 5g masła na każde 2 jajka w jajecznicy, 5g oleju rzepakowego na porcję mięsa). Zwróć go jako osobny produkt (np. "masło do smażenia" / "olej do smażenia") lub uwzględnij w wartościach dania głównego.`
}

function parsingRulesBlock(mode: 'full' | 'grams_only' | 'macros_only'): string {
  const gramsRule = mode === 'grams_only'
    ? `0. POLE "grams" ZAWSZE ZAWIERA MASĘ W GRAMACH — nigdy liczbę sztuk. Jeśli użytkownik podaje "7 sztuk", "3 kawałki", "2 kostki" itp., przelicz na gramy (korzystając z przeliczników powyżej lub własnej wiedzy) i wpisz masę w gramach. Przykład: "7 sztuk ptasiego mleczka" → grams: 91 (7 x 13g).
1. GRAMATURA EXPLICITE JEST ŚWIĘTA. Jeśli tekst zawiera "130 g ziemniaki", gramatura ziemniaków MUSI wynosić dokładnie 130g. Nie zaokrąglaj do 150g ani 200g.
2. Zwróć każdy produkt jako osobny obiekt w tablicy. Nie sumuj posiłku w jedno entry.`
    : `0. POLE "grams" ZAWSZE ZAWIERA MASĘ W GRAMACH — nigdy liczbę sztuk. Jeśli użytkownik podaje "4 naleśniki", "3 jajka", "2 kromki" itp., przelicz na gramy (liczba × waga 1 szt.) i wpisz masę łączną. Przykład: "4 naleśniki z serem" → grams: 300 (4 × 75g).
1. GRAMATURA EXPLICITE JEST ŚWIĘTA — nie zmieniaj gramatur podanych w liście produktów.
2. Zwróć każdy produkt jako osobny obiekt w tablicy. Nie sumuj posiłku w jedno entry.
3. Zweryfikuj matematykę przed wygenerowaniem wyniku! Obliczenia wartości odżywczych dla całej gramatury (grams):
   calories = (wartość_kcal_na_100g * grams) / 100 (zaokrąglone do liczby całkowitej)
   protein = (wartość_B_na_100g * grams) / 100 (zaokrąglone do 1 miejsca po przecinku)
   carbs = (wartość_W_na_100g * grams) / 100 (zaokrąglone do 1 miejsca po przecinku)
   fat = (wartość_T_na_100g * grams) / 100 (zaokrąglone do 1 miejsca po przecinku)
   fiber = błonnik w gramach dla całej porcji (zaokrąglone do 1 miejsca po przecinku). Jeśli brak informacji w bazie odniesienia, oszacuj na podstawie ogólnej wiedzy dietetycznej (np. chleb pełnoziarnisty/płatki mają ok. 6-10g błonnika/100g, owoce/warzywa mają ok. 1.5-3g błonnika/100g, mięsa/oleje mają 0g).
   sugar = cukry proste w gramach dla całej porcji (zaokrąglone do 1 miejsca po przecinku). Jeśli brak informacji w bazie odniesienia, oszacuj na podstawie ogólnej wiedzy dietetycznej (np. owoce mają ok. 5-12g cukru/100g, nabiał ma ok. 4g laktozy/100g, słodycze i miód mają wysoki cukier, mięsa/tłuszcze mają 0g).`

  return `BARDZO WAŻNE REGUŁY PARSOWANIA:
${gramsRule}`
}

function confidenceRulesBlock(): string {
  return `ZASADY PEWNOŚCI (confidence + assumptions):
- confidence: "high" — gramatura podana wprost LUB dopasowanie do bazy/FOOD_REF bez zgadywania porcji.
- confidence: "medium" — rozsądne domyślne porcje (np. 1 jajko, standardowy dodatek).
- confidence: "low" — niepewna gramatura, nieznana potrawa, szacunek „na oko”, domyślna porcja mięsa bez kontekstu.
- Jeśli confidence to "low" lub "medium" z domyślną porcją — ZAWSZE dodaj assumptions (np. "domyślna porcja mięsa 150g", "nie podano gramatury — szacunek 130g ryżu gotowanego").`
}

function jsonSchemaBlock(mode: 'full' | 'grams_only' | 'macros_only'): string {
  if (mode === 'grams_only') {
    return `Zwróć WYŁĄCZNIE poprawny format JSON (żadnego dodatkowego tekstu ani markdownu poza JSON):
{"items":[{"name":"dokładna nazwa produktu gotowego/potrawy","grams":130,"confidence":"high|medium|low","assumptions":["opcjonalna lista założeń gdy szacujesz gramaturę"]}]}`
  }
  if (mode === 'macros_only') {
    return `Zwróć WYŁĄCZNIE poprawny format JSON (żadnego dodatkowego tekstu ani markdownu poza JSON):
{"items":[{"name":"dokładna nazwa produktu","grams":130,"calories":113,"protein":2.5,"carbs":26.0,"fat":0.1,"fiber":1.8,"sugar":0.6,"confidence":"high|medium|low","assumptions":["opcjonalna lista założeń"]}]}`
  }
  return `Zwróć WYŁĄCZNIE poprawny format JSON (żadnego dodatkowego tekstu ani markdownu poza JSON):
{"items":[{"name":"dokładna nazwa produktu gotowego/potrawy","grams":130,"calories":113,"protein":2.5,"carbs":26.0,"fat":0.1,"fiber":1.8,"sugar":0.6,"confidence":"high|medium|low","assumptions":["opcjonalna lista założeń"]}]}`
}

function contextBlocks(ctx: UserParseContext): string {
  const blocks: string[] = []
  if (ctx.favoritesBlock.trim()) {
    blocks.push(`ULUBIONE PRODUKTY UŻYTKOWNIKA (preferuj te nazwy i porcje gdy pasują):
${ctx.favoritesBlock.trim()}`)
  }
  if (ctx.correctionsBlock.trim()) {
    blocks.push(`POPRAWKI UŻYTKOWNIKA (nadpisują domyślne szacunki):
${ctx.correctionsBlock.trim()}`)
  }
  if (ctx.historyBlock.trim()) {
    blocks.push(`PRODUKTY CZĘSTO LOGOWANE (preferuj te nazwy i styl porcji — audyt historii):
${ctx.historyBlock.trim()}`)
  }
  return blocks.length ? `\n\n${blocks.join('\n\n')}` : ''
}

export function buildSystemPrompt(ctx: UserParseContext, mode: 'full' | 'grams_only' | 'macros_only'): string {
  const intro = mode === 'grams_only'
    ? `Jesteś precyzyjnym parserem polskich opisów posiłków dla konkretnego użytkownika (${ctx.profileLine}, cel: ${ctx.targetKcal} kcal, ${ctx.targetProtein}g białka).
Użytkownik podaje tekstowy opis tego, co zjadł. Twoim zadaniem jest zidentyfikować poszczególne produkty i oszacować ich gramaturę (jeśli nie podano). NIE obliczaj jeszcze kalorii ani makro — tylko name i grams.`
    : mode === 'macros_only'
    ? `Jesteś precyzyjnym kalkulatorem makroskładników polskich posiłków dla konkretnego użytkownika (${ctx.profileLine}, cel: ${ctx.targetKcal} kcal, ${ctx.targetProtein}g białka).
Otrzymujesz listę produktów z ustaloną gramaturą. Oblicz kalorie i makroskładniki dla każdego produktu według bazy odniesienia.`
    : `Jesteś precyzyjnym parserem polskich opisów posiłków dla konkretnego użytkownika (${ctx.profileLine}, cel: ${ctx.targetKcal} kcal, ${ctx.targetProtein}g białka).
Użytkownik podaje tekstowy opis tego, co zjadł. Twoim zadaniem jest zidentyfikować poszczególne produkty, oszacować ich gramaturę (jeśli nie podano) oraz obliczyć kalorie i makroskładniki.`

  return `${intro}

BAZA WARTOŚCI ODNIESIENIA (na 100g):
${FOOD_REF}

${portionRulesBlock()}

${complexDishRulesBlock()}

${rawVsCookedBlock()}

${hiddenFatBlock()}

${confidenceRulesBlock()}

${parsingRulesBlock(mode)}${contextBlocks(ctx)}

${jsonSchemaBlock(mode)}`
}

function parseConfidence(value: unknown): 'high' | 'medium' | 'low' {
  const v = String(value || '').toLowerCase()
  if (v === 'high' || v === 'medium' || v === 'low') return v
  return 'medium'
}

function parseAssumptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.map((a) => String(a).trim()).filter(Boolean)
  return items.length ? items : undefined
}

export function normalizeRawItems(raw: unknown): ParsedFoodItem[] {
  const parsed = typeof raw === 'string'
    ? parseJsonFromContent(raw)
    : (raw && typeof raw === 'object' ? raw as Record<string, unknown> : null)

  if (!parsed) return []

  const rawItems: unknown[] = Array.isArray(parsed.items)
    ? parsed.items as unknown[]
    : Array.isArray(parsed)
    ? parsed as unknown[]
    : []

  return rawItems
    .map((entry) => {
      const item = entry as Record<string, unknown>
      const name = String(item.name || '').trim()
      if (!name) return null

      const grams = Math.max(1, Math.round(Number(item.grams) || 100))
      const calories = Math.max(0, Math.round(Number(item.calories) || 0))
      const protein = Math.max(0, Math.round(Number(item.protein) * 10) / 10)
      const carbs = Math.max(0, Math.round(Number(item.carbs ?? 0) * 10) / 10)
      const fat = Math.max(0, Math.round(Number(item.fat ?? 0) * 10) / 10)

      const result: ParsedFoodItem = {
        name,
        grams,
        calories,
        protein,
        carbs,
        fat,
        confidence: parseConfidence(item.confidence),
        source: 'llm',
      }

      if (item.fiber != null) {
        result.fiber = Math.max(0, Math.round(Number(item.fiber) * 10) / 10)
      }
      if (item.sugar != null) {
        result.sugar = Math.max(0, Math.round(Number(item.sugar) * 10) / 10)
      }
      const assumptions = parseAssumptions(item.assumptions)
      if (assumptions) result.assumptions = assumptions

      return result
    })
    .filter((item): item is ParsedFoodItem => item != null && item.name.length > 0)
}

export async function callParseLLM(
  apiKey: string,
  system: string,
  userText: string,
  maxTokens?: number,
): Promise<unknown> {
  const result = await deepseekChat({
    apiKey,
    model: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: maxTokens ?? 1200,
    timeoutMs: 25000,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
  })

  return parseJsonFromContent(result.content)
}

export async function parseMealText(
  apiKey: string,
  text: string,
  ctx: UserParseContext,
): Promise<ParsedFoodItem[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (isComplexMeal(trimmed)) {
    const gramsRaw = await callParseLLM(
      apiKey,
      buildSystemPrompt(ctx, 'grams_only'),
      `Parsuj: "${trimmed}"`,
      800,
    )
    const gramItems = normalizeRawItems(gramsRaw)
    if (gramItems.length === 0) return []

    const itemsForMacros = gramItems.map(({ name, grams }) => ({ name, grams }))
    const macrosRaw = await callParseLLM(
      apiKey,
      buildSystemPrompt(ctx, 'macros_only'),
      `Oblicz makro dla produktów (gramatura ustalona):\n${JSON.stringify(itemsForMacros, null, 2)}\n\nOryginalny opis: "${trimmed}"`,
      1200,
    )
    const macroItems = normalizeRawItems(macrosRaw)
    let merged = macroItems.map((item, i) => {
      const gramItem = gramItems[i]
      if (!gramItem) return item
      const conf = item.confidence === 'medium' && gramItem.confidence !== 'medium'
        ? gramItem.confidence
        : item.confidence
      const assumptions = item.assumptions?.length
        ? item.assumptions
        : gramItem.assumptions
      return {
        ...item,
        confidence: conf,
        ...(assumptions?.length ? { assumptions } : {}),
      }
    })
    merged = applyDeclaredPieceCount(trimmed, merged)
    return merged
  }

  const fullRaw = await callParseLLM(
    apiKey,
    buildSystemPrompt(ctx, 'full'),
    `Parsuj: "${trimmed}"`,
  )
  let items = normalizeRawItems(fullRaw)
  items = applyDeclaredPieceCount(trimmed, items)
  return items
}

function pickBestMatch(query: string, results: Per100gFood[]): Per100gFood | null {
  if (!results.length) return null

  const qWords = normalizePl(query).split(/\s+/).filter(Boolean)
  if (qWords.length === 0) return null

  for (const r of results) {
    if (r.calories == null) continue
    const name = normalizePl(r.name)
    if (qWords.every((w) => name.includes(w))) return r
  }

  return results.find((r) => r.calories != null) ?? null
}

function recalcFromPer100g(grams: number, per100: Per100gFood): Pick<ParsedFoodItem, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar'> {
  const factor = grams / 100
  const round1 = (n: number) => Math.round(n * 10) / 10

  return {
    calories: Math.round(Number(per100.calories) * factor),
    protein: round1(Number(per100.protein ?? 0) * factor),
    carbs: round1(Number(per100.carbs ?? 0) * factor),
    fat: round1(Number(per100.fat ?? 0) * factor),
    fiber: per100.fiber != null ? round1(Number(per100.fiber) * factor) : undefined,
    sugar: per100.sugar != null ? round1(Number(per100.sugar) * factor) : undefined,
  }
}

async function lookupViaDatabase(
  name: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<Per100gFood | null> {
  const res = await fetch(
    `${supabaseUrl}/functions/v1/lookup-food?q=${encodeURIComponent(name)}`,
    {
      headers: { Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(15000),
    },
  )
  if (!res.ok) return null

  const json = await res.json().catch(() => ({})) as { results?: Per100gFood[] }
  return pickBestMatch(name, json.results ?? [])
}

async function lookupViaLibrary(
  name: string,
  userId: string,
  db: any,
): Promise<Per100gFood | null> {
  const { data, error } = await db
    .from('food_library')
    .select('name, calories, protein, carbs, fat, fiber, sugar')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(10)

  if (error || !data?.length) return null
  return pickBestMatch(name, data as Per100gFood[])
}

async function reconcileOne(
  item: ParsedFoodItem,
  opts: { supabaseUrl: string; serviceKey: string; userId?: string; db?: any },
): Promise<ParsedFoodItem> {
  let match: Per100gFood | null = null
  let source: 'library' | 'database' | null = null

  if (opts.userId && opts.db) {
    match = await lookupViaLibrary(item.name, opts.userId, opts.db)
    if (match?.calories != null) source = 'library'
  }

  if (!match?.calories) {
    match = await lookupViaDatabase(item.name, opts.supabaseUrl, opts.serviceKey)
    if (match?.calories != null) source = 'database'
  }

  if (match?.calories != null && source) {
    const macros = recalcFromPer100g(item.grams, match)
    return {
      ...item,
      ...macros,
      name: match.name || item.name,
      confidence: 'high',
      source,
      assumptions: item.assumptions,
    }
  }

  return item
}

export async function reconcileItems(
  items: ParsedFoodItem[],
  opts: { supabaseUrl: string; serviceKey: string; userId?: string; db?: any },
): Promise<ParsedFoodItem[]> {
  // Items are independent — reconciling them one-at-a-time turned a 3-item meal into
  // up to 3x15s of sequential lookup-food round trips, blowing the caller's 35s budget.
  return Promise.all(items.map((item) => reconcileOne(item, opts)))
}
