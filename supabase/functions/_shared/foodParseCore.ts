import { deepseekChat, parseJsonFromContent } from './deepseek.ts'
import { lookupGenericFood, scoreFoodNameMatch } from './foodGeneric.ts'
import { lookupReferencePl } from './foodReferencePl.ts'

export const PARSER_VERSION = '2026-06-28'

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
pizza Margherita: 250/10/30/10
wątróbka wieprzowa smażona: 165/26/4/5
wątróbka drobiowa smażona: 167/25/4/6
borówki: 57/0.7/14/0.3
kaszanka: 379/14/1/35
karkówka wieprzowa pieczona: 250/24/0/17`

export interface FoodParseMeta {
  macroSource: 'library' | 'generic' | 'reference_pl' | 'off' | 'llm_estimate' | 'user_correction'
  matchScore?: number
  matchedName?: string
  parserVersion: string
}

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
  parseMeta?: FoodParseMeta
}

export interface UserParseContext {
  profileLine: string
  targetKcal: number | null
  targetProtein: number | null
  favoritesBlock: string
  correctionsBlock: string
  historyBlock: string
  portionsBlock: string
}

export interface FoodCorrection {
  query_name: string
  corrected_name: string | null
  corrected_grams: number
}

export interface FinalizeFoodParseOpts {
  originalText: string
  corrections?: FoodCorrection[]
  supabaseUrl: string
  serviceKey: string
  userId?: string
  db?: unknown
  apiKey?: string
  parseContext?: UserParseContext
}

interface Per100gFood {
  name: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber?: number | null
  sugar?: number | null
  source?: 'generic' | 'reference_pl' | 'off'
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

/** Domowe ≈ mniej cukru/tłuszczu niż paczka/restauracja — tylko dla szacunków LLM. */
export function applyHomemadeAdjustment(text: string, items: ParsedFoodItem[]): ParsedFoodItem[] {
  if (!isHomemadeContext(text)) return items

  return items.map((item) => {
    if (item.source !== 'llm') return item
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
  if (ctx.portionsBlock && ctx.portionsBlock.trim()) {
    blocks.push(`STANDARDOWE PORCJE UŻYTKOWNIKA (użyj tych wartości w gramach, gdy użytkownik podaje te potrawy):
${ctx.portionsBlock.trim()}`)
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

export function normalizeGramOnlyItems(raw: unknown): ParsedFoodItem[] {
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
      const assumptions = parseAssumptions(item.assumptions)

      const result: ParsedFoodItem = {
        name,
        grams,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidence: parseConfidence(item.confidence),
        source: 'llm',
        parseMeta: { macroSource: 'llm_estimate', parserVersion: PARSER_VERSION },
      }
      if (assumptions) result.assumptions = assumptions
      return result
    })
    .filter((item): item is ParsedFoodItem => item != null && item.name.length > 0)
}

export function isUnmatchedForMacros(item: ParsedFoodItem): boolean {
  return item.source === 'llm'
    && item.calories === 0
    && item.protein === 0
    && item.carbs === 0
    && item.fat === 0
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
        parseMeta: { macroSource: 'llm_estimate', parserVersion: PARSER_VERSION },
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
    timeoutMs: 32000,
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

  // LLM: name + grams only. Makro liczy kod z bazy (RAG), nie model.
  const gramsRaw = await callParseLLM(
    apiKey,
    buildSystemPrompt(ctx, 'grams_only'),
    `Parsuj: "${trimmed}"`,
    isComplexMeal(trimmed) ? 1200 : 800,
  )
  let items = normalizeGramOnlyItems(gramsRaw)
  items = applyDeclaredPieceCount(trimmed, items)
  return items
}

const MIN_RECONCILE_SCORE = 0.52

function pickBestMatchScored(query: string, results: Per100gFood[]): { match: Per100gFood; score: number } | null {
  if (!results.length) return null

  let best: Per100gFood | null = null
  let bestScore = MIN_RECONCILE_SCORE

  for (const r of results) {
    if (r.calories == null || !r.name) continue
    const score = scoreFoodNameMatch(query, r.name)
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best ? { match: best, score: bestScore } : null
}

function pickBestMatch(query: string, results: Per100gFood[]): Per100gFood | null {
  return pickBestMatchScored(query, results)?.match ?? null
}

function findCorrectionForItem(
  item: ParsedFoodItem,
  corrections: FoodCorrection[],
  originalText: string,
  itemCount: number,
): FoodCorrection | null {
  const itemNorm = normalizePl(item.name)
  for (const c of corrections) {
    const q = normalizePl(c.query_name)
    if (!q) continue
    if (itemNorm.includes(q) || q.includes(itemNorm)) return c
  }
  if (itemCount === 1) {
    const textNorm = normalizePl(originalText)
    for (const c of corrections) {
      const q = normalizePl(c.query_name)
      if (q && textNorm.includes(q)) return c
    }
  }
  return null
}

/** Hard override from food_corrections — deterministic, not prompt-only. */
export function applyUserCorrections(
  items: ParsedFoodItem[],
  corrections: FoodCorrection[] | undefined,
  originalText: string,
): ParsedFoodItem[] {
  if (!corrections?.length) return items

  return items.map((item) => {
    const c = findCorrectionForItem(item, corrections, originalText, items.length)
    if (!c) return item

    const newGrams = Math.max(1, c.corrected_grams)
    const scaled = newGrams !== item.grams ? scaleParsedItem(item, newGrams / item.grams) : item

    return {
      ...scaled,
      name: c.corrected_name?.trim() || item.name,
      grams: newGrams,
      confidence: 'high',
      source: 'library',
      parseMeta: {
        macroSource: 'user_correction',
        matchedName: c.corrected_name?.trim() || item.name,
        parserVersion: PARSER_VERSION,
      },
      assumptions: [
        ...(item.assumptions ?? []),
        `poprawka użytkownika: ${newGrams}g`,
      ],
    }
  })
}

function splitCompoundName(name: string): [string, string] | null {
  const parts = normalizePl(name).split(/\s+(?:z|ze)\s+/)
  if (parts.length !== 2) return null
  const [a, b] = parts.map((p) => p.trim())
  if (a.length < 3 || b.length < 3) return null
  return [a, b]
}

function titleCasePl(fragment: string): string {
  const trimmed = fragment.trim()
  if (!trimmed) return fragment
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/** "wątróbka z cebulą" → dwa składniki z bazy, jeśli oba się dopasują. */
async function tryExpandCompoundItems(
  items: ParsedFoodItem[],
  opts: { supabaseUrl: string; serviceKey: string; userId?: string; db?: unknown },
): Promise<ParsedFoodItem[]> {
  if (items.length !== 1 || !isUnmatchedForMacros(items[0])) return items

  const split = splitCompoundName(items[0].name)
  if (!split) return items

  const [mainRaw, secRaw] = split
  const totalGrams = items[0].grams
  const mainGrams = Math.max(1, Math.round(totalGrams * 0.82))
  const secGrams = Math.max(1, totalGrams - mainGrams)

  const base = items[0]
  const mainItem: ParsedFoodItem = {
    ...base,
    name: titleCasePl(mainRaw),
    grams: mainGrams,
  }
  const secItem: ParsedFoodItem = {
    ...base,
    name: titleCasePl(secRaw),
    grams: secGrams,
  }

  const [rMain, rSec] = await Promise.all([
    reconcileOne(mainItem, opts),
    reconcileOne(secItem, opts),
  ])

  if (rMain.source === 'llm' && isUnmatchedForMacros(rMain) && rSec.source === 'llm' && isUnmatchedForMacros(rSec)) {
    return items
  }

  const assumption = `rozbite na składniki (${mainGrams}g + ${secGrams}g)`
  return [
    { ...rMain, assumptions: [...(rMain.assumptions ?? []), assumption] },
    { ...rSec, assumptions: [...(rSec.assumptions ?? []), assumption] },
  ]
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

async function lookupOffFast(
  name: string,
): Promise<{ match: Per100gFood; score: number; macroSource: 'off' } | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5&tagtype_0=languages&tag_contains_0=contains&tag_0=polish`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VanguardOS/1.0 (personal nutrition log)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = await res.json() as { products?: Array<{ product_name?: string; nutriments?: Record<string, number> }> }
    const results: Per100gFood[] = (json.products ?? [])
      .filter((p) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
      .map((p) => ({
        name: p.product_name!,
        calories: Math.round(Number(p.nutriments!['energy-kcal_100g'])),
        protein: p.nutriments!['proteins_100g'] ?? 0,
        carbs: p.nutriments!['carbohydrates_100g'] ?? 0,
        fat: p.nutriments!['fat_100g'] ?? 0,
        fiber: p.nutriments!['fiber_100g'],
        sugar: p.nutriments!['sugars_100g'],
        source: 'off' as const,
      }))
    const picked = pickBestMatchScored(name, results)
    if (!picked) return null
    return { match: picked.match, score: picked.score, macroSource: 'off' }
  } catch {
    return null
  }
}

async function verifyMatchWithLLM(
  query: string,
  candidate: string,
  apiKey: string,
): Promise<boolean> {
  const prompt = `Jesteś precyzyjnym dietetykiem-sędzią. Decydujesz, czy wyszukiwany produkt spożywczy (Query) odpowiada produktowi znalezionemu w bazie danych (Candidate).
Czasami algorytmy dopasowują podobnie brzmiące słowa, które oznaczają zupełnie co innego.

Przykłady:
Query: "borówki", Candidate: "Ser topiony Borówka" -> NIE
Query: "borówka", Candidate: "Borówki amerykańskie świeże" -> TAK
Query: "kebab", Candidate: "Kebab w cienkim cieście" -> TAK
Query: "szynka", Candidate: "Szynka konserwowa kurczak" -> TAK
Query: "mleko", Candidate: "Czekolada mleczna" -> NIE

Zasada: Czy Candidate to w 100% ten sam rodzaj jedzenia co Query? Odpowiedz TYLKO słowem TAK lub NIE.
Query: "${query}"
Candidate: "${candidate}"
Decyzja:`

  try {
    const res = await deepseekChat({
      apiKey,
      model: 'deepseek-chat',
      temperature: 0,
      maxTokens: 5,
      timeoutMs: 5000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content.trim().toUpperCase()
    return text.includes('TAK')
  } catch {
    return true
  }
}

async function reconcileOne(
  item: ParsedFoodItem,
  opts: ReconcileOpts,
): Promise<ParsedFoodItem> {
  let match: Per100gFood | null = null
  let source: ParsedFoodItem['source'] = 'llm'
  let macroSource: FoodParseMeta['macroSource'] = 'llm_estimate'
  let matchScore: number | undefined
  let matchedName: string | undefined

  if (opts.userId && opts.db) {
    const lib = pickBestMatchScored(item.name, (await lookupViaLibraryRaw(item.name, opts.userId, opts.db)) ?? [])
    if (lib) {
      match = lib.match
      source = 'library'
      macroSource = 'library'
      matchScore = lib.score
      matchedName = lib.match.name
    }
  }

  if (!match?.calories) {
    const ref = lookupReferencePl(item.name)
    if (ref) {
      match = ref
      source = 'database'
      macroSource = 'reference_pl'
      matchedName = ref.name
      matchScore = scoreFoodNameMatch(item.name, ref.name)
    }
  }

  if (!match?.calories) {
    const local = lookupGenericFood(item.name)
    if (local) {
      match = local
      source = 'database'
      macroSource = 'generic'
      matchedName = local.name
      matchScore = scoreFoodNameMatch(item.name, local.name)
    }
  }

  if (!match?.calories) {
    const remote = await lookupOffFast(item.name)
    if (remote?.match.calories != null) {
      match = remote.match
      source = 'database'
      macroSource = remote.macroSource
      matchScore = remote.score
      matchedName = remote.match.name
    }
  }

  if (matchScore != null && matchScore >= 0.50 && matchScore <= 0.72 && opts.apiKey && matchedName) {
    const ok = await verifyMatchWithLLM(item.name, matchedName, opts.apiKey)
    if (!ok) {
      match = null
      source = 'llm'
      macroSource = 'llm_estimate'
      matchScore = undefined
      matchedName = undefined
    }
  }

  if (match?.calories != null && source !== 'llm') {
    const macros = recalcFromPer100g(item.grams, match)
    return {
      ...item,
      ...macros,
      name: match.name || item.name,
      confidence: 'high',
      source,
      assumptions: item.assumptions,
      parseMeta: {
        macroSource,
        matchScore,
        matchedName,
        parserVersion: PARSER_VERSION,
      },
    }
  }

  return item
}

async function lookupViaLibraryRaw(
  name: string,
  userId: string,
  db: any,
): Promise<Per100gFood[] | null> {
  const { data, error } = await db
    .from('food_library')
    .select('name, calories, protein, carbs, fat, fiber, sugar')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(10)

  if (error || !data?.length) return null
  return data as Per100gFood[]
}

type ReconcileOpts = { supabaseUrl: string; serviceKey: string; userId?: string; db?: unknown; apiKey?: string }

export async function reconcileItems(
  items: ParsedFoodItem[],
  opts: ReconcileOpts,
): Promise<ParsedFoodItem[]> {
  return Promise.all(items.map((item) => reconcileOne(item, opts)))
}

async function fillMacrosLlmFallback(
  items: ParsedFoodItem[],
  apiKey: string,
  ctx: UserParseContext,
  originalText: string,
): Promise<ParsedFoodItem[]> {
  const indices = items
    .map((item, i) => (isUnmatchedForMacros(item) ? i : -1))
    .filter((i) => i >= 0)
  if (!indices.length) return items

  const payload = indices.map((i) => ({ name: items[i].name, grams: items[i].grams }))
  const macrosRaw = await callParseLLM(
    apiKey,
    buildSystemPrompt(ctx, 'macros_only'),
    `Oblicz makro dla produktów (gramatura ustalona):\n${JSON.stringify(payload, null, 2)}\n\nOryginalny opis: "${originalText}"`,
    1200,
  )
  const macroItems = normalizeRawItems(macrosRaw)
  const out = [...items]

  for (let j = 0; j < indices.length; j++) {
    const idx = indices[j]
    const macro = macroItems[j]
      ?? macroItems.find((m) => normalizePl(m.name).includes(normalizePl(out[idx].name)))
    if (!macro) continue

    out[idx] = {
      ...out[idx],
      calories: macro.calories,
      protein: macro.protein,
      carbs: macro.carbs,
      fat: macro.fat,
      fiber: macro.fiber,
      sugar: macro.sugar,
      confidence: macro.confidence === 'high' ? 'medium' : macro.confidence,
      source: 'llm',
      assumptions: [
        ...(out[idx].assumptions ?? []),
        ...(macro.assumptions ?? []),
        'makro szacowane — brak w bazie',
      ],
      parseMeta: {
        macroSource: 'llm_estimate',
        parserVersion: PARSER_VERSION,
      },
    }
  }

  return out
}

/**
 * Canonical post-LLM pipeline — single entry point for parse-food-nl.
 * Order: corrections → reconcile → compound split → homemade → macro math.
 */
export async function finalizeParsedItems(
  items: ParsedFoodItem[],
  opts: FinalizeFoodParseOpts,
): Promise<ParsedFoodItem[]> {
  const reconcileOpts: ReconcileOpts = {
    supabaseUrl: opts.supabaseUrl,
    serviceKey: opts.serviceKey,
    userId: opts.userId,
    db: opts.db,
    apiKey: opts.apiKey,
  }

  let out = applyUserCorrections(items, opts.corrections, opts.originalText)
  out = await reconcileItems(out, reconcileOpts)
  out = await tryExpandCompoundItems(out, reconcileOpts)

  if (opts.apiKey && opts.parseContext) {
    out = await fillMacrosLlmFallback(out, opts.apiKey, opts.parseContext, opts.originalText)
  }

  out = applyHomemadeAdjustment(opts.originalText, out)
  out = applyPhysiologicalGuardrails(out, opts.originalText)
  out = enforceMacroMath(out)
  return out
}

interface GuardrailRule {
  keywords: string[]
  maxGrams: number
  defaultGrams: number
}

const NUTRITION_GUARDRAILS: GuardrailRule[] = [
  { keywords: ['maslo', 'masla'], maxGrams: 35, defaultGrams: 10 },
  { keywords: ['olej', 'oleju', 'rzepakow', 'slonecznik'], maxGrams: 35, defaultGrams: 10 },
  { keywords: ['oliwa', 'oliwy'], maxGrams: 35, defaultGrams: 10 },
  { keywords: ['sol', 'soli'], maxGrams: 10, defaultGrams: 2 },
  { keywords: ['cukier', 'cukru'], maxGrams: 50, defaultGrams: 10 },
  { keywords: ['maslo orzechowe', 'masla orzechowego'], maxGrams: 60, defaultGrams: 20 },
]

export function applyPhysiologicalGuardrails(items: ParsedFoodItem[], originalText: string): ParsedFoodItem[] {
  const normText = normalizePl(originalText)

  return items.map((item) => {
    const normName = normalizePl(item.name)
    for (const rule of NUTRITION_GUARDRAILS) {
      const matches = rule.keywords.some((kw) => normName.includes(kw))
      if (matches && item.grams > rule.maxGrams) {
        // Sprawdź czy użytkownik wpisał ilość jawnie (np. "50g masła", "masło 50g")
        const explicitePattern = new RegExp(`(\\d+)\\s*(?:g|gram\\w*|szt\\w*)\\s*(?:${rule.keywords.join('|')})|(?:${rule.keywords.join('|')})\\s*(\\d+)`, 'i')
        const isExplicite = explicitePattern.test(normText)

        if (!isExplicite) {
          const originalGrams = item.grams
          const adjustedGrams = rule.defaultGrams
          const scale = adjustedGrams / originalGrams

          return {
            ...item,
            grams: adjustedGrams,
            calories: Math.round(item.calories * scale),
            protein: Math.round(item.protein * scale * 10) / 10,
            carbs: Math.round(item.carbs * scale * 10) / 10,
            fat: Math.round(item.fat * scale * 10) / 10,
            fiber: item.fiber != null ? Math.round(item.fiber * scale * 10) / 10 : undefined,
            sugar: item.sugar != null ? Math.round(item.sugar * scale * 10) / 10 : undefined,
            confidence: 'low',
            assumptions: [
              ...(item.assumptions ?? []),
              `guardrail: przycięto gramaturę ${item.name} z ${originalGrams}g do ${adjustedGrams}g (brak explicite w opisie)`,
            ],
          }
        }
      }
    }
    return item
  })
}

/** Auto-save only when every line is high-confidence (baza / explicite gramy / poprawka). */
export function needsFoodReview(items: ParsedFoodItem[]): boolean {
  if (!items.length) return false
  return items.some((i) => i.confidence !== 'high')
}

const MACRO_MISMATCH_TOLERANCE = 0.15

export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9)
}

/**
 * The LLM is told to compute calories = 4*protein + 4*carbs + 9*fat, but doesn't always
 * follow its own arithmetic — observed in production as the same dish (identical P/C/F)
 * logged with two different calorie totals on different days. Scanned/database items
 * (source !== 'llm') carry real label values that legitimately don't satisfy a clean
 * 4-4-9 split (Atwater factors vary, label rounding, etc.) — only correct items the LLM
 * itself estimated end-to-end.
 */
export function enforceMacroMath(items: ParsedFoodItem[]): ParsedFoodItem[] {
  return items.map((item) => {
    if (item.source !== 'llm') return item

    const computed = caloriesFromMacros(item.protein, item.carbs, item.fat)
    if (computed <= 0) return item

    const diff = Math.abs(computed - item.calories) / Math.max(computed, item.calories)
    if (diff <= MACRO_MISMATCH_TOLERANCE) {
      if (item.calories !== computed) {
        return { ...item, calories: computed }
      }
      return item
    }

    return {
      ...item,
      calories: computed,
      confidence: 'low',
      assumptions: [
        ...(item.assumptions ?? []),
        `kalorie skorygowane z B/W/T (model podał ${item.calories} kcal, niezgodne z makro)`,
      ],
    }
  })
}
