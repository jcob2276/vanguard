/** Curated per-100g staples (Polish home cooking). SSOT for lookup-food + NL reconcile. */

export interface GenericFoodPer100g {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
}

export const GENERIC_FOODS: GenericFoodPer100g[] = [
  { name: 'Ziemniaki gotowane', calories: 87, protein: 1.9, carbs: 20, fat: 0.1, fiber: 1.8, sugar: 0.8 },
  { name: 'Ziemniaki pieczone', calories: 93, protein: 2.1, carbs: 21.2, fat: 0.1, fiber: 2.1, sugar: 1.2 },
  { name: 'Ryż biały gotowany', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1 },
  { name: 'Ryż brązowy gotowany', calories: 123, protein: 2.6, carbs: 25.6, fat: 1, fiber: 1.6, sugar: 0.4 },
  { name: 'Kasza gryczana gotowana', calories: 92, protein: 3.4, carbs: 19.9, fat: 0.6, fiber: 2.7, sugar: 0.6 },
  { name: 'Kasza jęczmienna gotowana', calories: 123, protein: 2.3, carbs: 28.2, fat: 0.4, fiber: 3.8, sugar: 0.3 },
  { name: 'Makaron gotowany', calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, sugar: 0.6 },
  { name: 'Jajko kurze ugotowane', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sugar: 1.1 },
  { name: 'Kurczak pierś pieczona bez skóry', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 },
  { name: 'Indyk pierś', calories: 135, protein: 29, carbs: 0, fat: 1, fiber: 0, sugar: 0 },
  { name: 'Wołowina mielona smażona 15% tłuszczu', calories: 254, protein: 26, carbs: 0, fat: 17, fiber: 0, sugar: 0 },
  { name: 'Wątróbka wieprzowa smażona', calories: 165, protein: 26, carbs: 4, fat: 5, fiber: 0, sugar: 0 },
  { name: 'Wątróbka drobiowa smażona', calories: 167, protein: 25, carbs: 4, fat: 6, fiber: 0, sugar: 0 },
  { name: 'Kaszanka', calories: 379, protein: 14, carbs: 1, fat: 35, fiber: 0, sugar: 0 },
  { name: 'Karkówka wieprzowa pieczona', calories: 250, protein: 24, carbs: 0, fat: 17, fiber: 0, sugar: 0 },
  { name: 'Łosoś pieczony', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0 },
  { name: 'Tuńczyk w wodzie', calories: 116, protein: 26, carbs: 0, fat: 1, fiber: 0, sugar: 0 },
  { name: 'Ogórek świeży', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sugar: 1.7 },
  { name: 'Pomidor świeży', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6 },
  { name: 'Sałata', calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, sugar: 0.8 },
  { name: 'Papryka czerwona świeża', calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sugar: 4.2 },
  { name: 'Brokuł gotowany', calories: 35, protein: 2.4, carbs: 7, fat: 0.4, fiber: 3.3, sugar: 1.7 },
  { name: 'Marchew świeża', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7 },
  { name: 'Cebula', calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2 },
  { name: 'Cebula smażona', calories: 92, protein: 1.1, carbs: 7.9, fat: 6, fiber: 1.4, sugar: 4 },
  { name: 'Borówki', calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4, sugar: 10 },
  { name: 'Borówki amerykańskie', calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4, sugar: 10 },
  { name: 'Maliny', calories: 52, protein: 1.2, carbs: 12, fat: 0.7, fiber: 6.5, sugar: 4.4 },
  { name: 'Banan', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 },
  { name: 'Jabłko', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4 },
  { name: 'Awokado', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7 },
  { name: 'Truskawki', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, sugar: 4.9 },
  { name: 'Mleko 2%', calories: 50, protein: 3.4, carbs: 4.8, fat: 2, fiber: 0, sugar: 4.8 },
  { name: 'Jogurt naturalny', calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, sugar: 4.7 },
  { name: 'Skyr naturalny', calories: 65, protein: 12, carbs: 4, fat: 0, fiber: 0, sugar: 4 },
  { name: 'Serek wiejski', calories: 97, protein: 11, carbs: 2, fat: 5, fiber: 0, sugar: 2 },
  { name: 'Twaróg półtłusty', calories: 137, protein: 18, carbs: 3.7, fat: 5, fiber: 0, sugar: 3.7 },
  { name: 'Ser żółty', calories: 350, protein: 25, carbs: 2, fat: 27, fiber: 0, sugar: 0.5 },
  { name: 'Masło', calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sugar: 0.1 },
  { name: 'Oliwa z oliwek', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0 },
  { name: 'Olej rzepakowy', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0 },
  { name: 'Chleb pszenny', calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sugar: 4 },
  { name: 'Chleb żytni', calories: 250, protein: 7, carbs: 48, fat: 1.5, fiber: 5.8, sugar: 1.4 },
  { name: 'Płatki owsiane', calories: 379, protein: 13, carbs: 67, fat: 7, fiber: 10, sugar: 1 },
  { name: 'Migdały', calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, sugar: 4.4 },
  { name: 'Orzechy włoskie', calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, sugar: 2.6 },
  { name: 'Soczewica gotowana', calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 1.8 },
  { name: 'Ciecierzyca gotowana', calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, sugar: 4.8 },
  { name: 'Fasola czerwona gotowana', calories: 127, protein: 8.7, carbs: 23, fat: 0.5, fiber: 6.4, sugar: 0.3 },
  { name: 'Tofu', calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, sugar: 0.6 },
  { name: 'Miód', calories: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, sugar: 82 },
  { name: 'Pierogi ruskie gotowane', calories: 200, protein: 6, carbs: 35, fat: 4, fiber: 2, sugar: 1 },
  { name: 'Kotlet schabowy smażony', calories: 270, protein: 17, carbs: 8, fat: 19, fiber: 0.5, sugar: 0 },
]

function normalizePlFood(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź|ż/g, 'z')
}

/** Score 0–1: how well candidate matches query. Rejects weak OFF/generic false positives. */
export function scoreFoodNameMatch(query: string, candidateName: string): number {
  const qWords = normalizePlFood(query).split(/\s+/).filter((w) => w.length > 1)
  if (qWords.length === 0) return 0

  const name = normalizePlFood(candidateName)
  const nameWords = name.split(/\s+/).filter(Boolean)
  if (nameWords.length === 0) return 0

  let matched = 0
  for (const w of qWords) {
    if (name.includes(w)) matched++
  }
  const coverage = matched / qWords.length
  if (coverage < 0.5) return 0

  const nameMatched = nameWords.filter((w) =>
    qWords.some((q) => w.includes(q) || q.includes(w)),
  ).length
  const precision = nameMatched / nameWords.length
  const extraPenalty = nameWords.length > qWords.length + 2 ? 0.15 : 0

  return Math.max(0, coverage * 0.65 + precision * 0.35 - extraPenalty)
}

const MIN_MATCH_SCORE = 0.52

export function pickBestGenericMatch(query: string, foods: GenericFoodPer100g[]): GenericFoodPer100g | null {
  let best: GenericFoodPer100g | null = null
  let bestScore = MIN_MATCH_SCORE

  for (const food of foods) {
    const score = scoreFoodNameMatch(query, food.name)
    if (score > bestScore) {
      bestScore = score
      best = food
    }
  }
  return best
}

export function searchGenericFoods(query: string): GenericFoodPer100g[] {
  const qWords = normalizePlFood(query).split(/\s+/).filter(Boolean)
  if (qWords.length === 0) return []
  return GENERIC_FOODS.filter((f) => {
    const name = normalizePlFood(f.name)
    return qWords.every((w) => name.includes(w))
  })
}

export function lookupGenericFood(query: string): GenericFoodPer100g | null {
  const candidates = searchGenericFoods(query)
  return pickBestGenericMatch(query, candidates.length ? candidates : GENERIC_FOODS)
}
