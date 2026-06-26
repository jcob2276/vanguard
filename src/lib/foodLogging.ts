import { supabase } from './supabase'
import { getTodayWarsaw, formatWarsawDate } from './date'
import { scheduleStrainRecompute } from './strainRefresh'

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
] as const

export type MealTypeId = (typeof MEAL_TYPES)[number]['id']

export interface ParsedFoodItem {
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number | null
  fat: number | null
  fiber?: number | null
  sugar?: number | null
  confidence?: 'high' | 'medium' | 'low'
  source?: 'llm' | 'database' | 'library'
  assumptions?: string[]
}

export interface TodayNutritionSnapshot {
  calories: number
  protein: number
  targetKcal: number | null
  targetProtein: number | null
  avgFoodQuality: number | null
  foodQualityAnalysis: string | null
}

const qualityTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function runFoodQualityAnalysis(userId: string, date: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return

  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food-quality`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, date }),
      signal: AbortSignal.timeout(55000),
    })
  } catch (e) {
    console.warn('[foodLogging] analyze-food-quality failed', e)
  }
}

/** Debounced background quality score — call after any food log for that date. */
export function scheduleFoodQualityAnalysis(userId: string, date: string): void {
  const key = `${userId}:${date}`
  const existing = qualityTimers.get(key)
  if (existing) clearTimeout(existing)
  qualityTimers.set(key, setTimeout(() => {
    qualityTimers.delete(key)
    void runFoodQualityAnalysis(userId, date)
  }, 2500))
}

export function defaultMealType(): MealTypeId {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export function getYesterdayWarsaw(): string {
  const today = getTodayWarsaw()
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return formatWarsawDate(d)
}

export async function fetchTodayNutrition(userId: string, date = getTodayWarsaw()): Promise<TodayNutritionSnapshot> {
  const [{ data: dayRow }, { data: targetRow }] = await Promise.all([
    supabase.from('daily_nutrition').select('calories, protein, avg_food_quality, food_quality_analysis').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase.from('nutrition_targets').select('target_kcal, protein_floor_g').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
  ])
  return {
    calories: dayRow?.calories ?? 0,
    protein: dayRow?.protein ?? 0,
    targetKcal: targetRow?.target_kcal ?? null,
    targetProtein: targetRow?.protein_floor_g ?? null,
    avgFoodQuality: dayRow?.avg_food_quality ?? null,
    foodQualityAnalysis: dayRow?.food_quality_analysis ?? null,
  }
}

export async function parseFoodNL(text: string, userId: string, accessToken: string): Promise<ParsedFoodItem[]> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-food-nl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.trim(), userId }),
    signal: AbortSignal.timeout(35000),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json.items ?? []
}

export function needsReview(items: ParsedFoodItem[]): boolean {
  return items.some((i) => (i.confidence ?? 'medium') === 'low')
}

export async function saveParsedFoodItems(
  userId: string,
  items: ParsedFoodItem[],
  opts: { date: string; mealType: string; mealGroupId?: string },
): Promise<void> {
  const groupId = opts.mealGroupId ?? (items.length > 1 ? crypto.randomUUID() : undefined)

  for (const item of items) {
    const grams = Math.max(1, Math.round(item.grams || 100))
    const scale100 = 100 / grams
    const { error } = await supabase.rpc('add_food_entry', {
      p_user_id: userId,
      p_date: opts.date,
      p_grams: grams,
      p_entry: {
        name: item.name,
        brand: null,
        barcode: null,
        calories: Math.round((item.calories || 0) * scale100),
        protein: Math.round((item.protein || 0) * scale100 * 10) / 10,
        carbs: item.carbs != null ? Math.round(item.carbs * scale100 * 10) / 10 : null,
        fat: item.fat != null ? Math.round(item.fat * scale100 * 10) / 10 : null,
        fiber: item.fiber != null ? Math.round(item.fiber * scale100 * 10) / 10 : null,
        sugar: item.sugar != null ? Math.round(item.sugar * scale100 * 10) / 10 : null,
        meal_type: opts.mealType,
        meal_group_id: groupId ?? null,
      },
    })
    if (error) throw error
  }

  scheduleFoodQualityAnalysis(userId, opts.date)
  scheduleStrainRecompute(userId)
}

export async function saveFoodCorrection(
  userId: string,
  queryName: string,
  correctedGrams: number,
  correctedName?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('save_food_correction', {
    p_user_id: userId,
    p_query_name: queryName,
    p_corrected_grams: correctedGrams,
    p_corrected_name: correctedName ?? null,
  } as any)
  if (error) throw error
}

export async function quickAddFavorite(
  userId: string,
  fav: { name: string; brand: string | null; barcode: string | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; sugar: number | null; default_grams: number },
  date: string,
  mealType: string,
): Promise<void> {
  const { error } = await supabase.rpc('add_food_entry', {
    p_user_id: userId,
    p_date: date,
    p_grams: fav.default_grams || 100,
    p_entry: {
      name: fav.name,
      brand: fav.brand,
      barcode: fav.barcode,
      calories: fav.calories,
      protein: fav.protein,
      carbs: fav.carbs,
      fat: fav.fat,
      fiber: fav.fiber,
      sugar: fav.sugar,
      meal_type: mealType,
    },
  })
  if (error) throw error
  scheduleFoodQualityAnalysis(userId, date)
  scheduleStrainRecompute(userId)
}

export async function repeatYesterdayMeal(userId: string, targetDate: string): Promise<boolean> {
  const yesterday = getYesterdayWarsaw()
  const { data: entries } = await supabase
    .from('daily_food_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', yesterday)
    .order('logged_at', { ascending: true })
    .limit(1)

  const first = entries?.[0]
  if (!first) return false

  const { error } = await supabase.rpc('repeat_food_entry', {
    p_user_id: userId,
    p_source_entry_id: first.id,
    p_date: targetDate,
  })
  if (error) throw error
  scheduleFoodQualityAnalysis(userId, targetDate)
  scheduleStrainRecompute(userId)
  return true
}

export function confidenceLabel(item: ParsedFoodItem): string | null {
  if (item.source === 'library' || item.source === 'database') return 'baza'
  if (item.confidence === 'high') return 'ok'
  if (item.confidence === 'low') return 'sprawdź'
  return null
}
