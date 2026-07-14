import { getWarsawHour } from '../../lib/date';
import { supabase } from '../supabase'
import { invokeEdge } from '../supabase'
import { scheduleStrainRecompute } from './strainRefresh'
import { TIMEOUTS } from '../constants'
import type { Json } from '../database.types'

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
] as const

export type MealTypeId = (typeof MEAL_TYPES)[number]['id']

interface FoodParseMeta {
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

export interface TodayNutritionSnapshot {
  calories: number
  protein: number
  targetKcal: number | null
  targetProtein: number | null
  avgFoodQuality: number | null
  foodQualityAnalysis: string | null
}

export * from './foodFavorites'

const qualityTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function runFoodQualityAnalysis(userId: string, date: string): Promise<void> {
  try {
    await invokeEdge('analyze-food-quality', {
      body: { userId, date },
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    })
  } catch (e: unknown) { console.warn('[foodLogging] Failed to run food quality analysis:', e); }
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
  const hour = getWarsawHour()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export async function parseFoodNL(text: string, userId: string, _accessToken: string): Promise<ParsedFoodItem[]> {
  let json: { items?: ParsedFoodItem[] }
  try {
    json = await invokeEdge('parse-food-nl', {
      body: { text: text.trim(), userId, clientTime: new Date().toISOString() },
      signal: AbortSignal.timeout(TIMEOUTS.llmHeavy),
    }) as { items?: ParsedFoodItem[] }
  } catch (e: unknown) {
    const msg = e instanceof Error ? (e as Error).message : String(e)
    if (/timed out|timeout|abort/i.test(msg)) {
      throw new Error('Parsowanie trwało za długo — spróbuj ponownie za chwilę.', { cause: e })
    }
    throw e
  }
  return json.items ?? []
}

export function needsReview(items: ParsedFoodItem[]): boolean {
  if (!items.length) return false
  return items.some((i) => i.confidence !== 'high')
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
        parse_meta: (item.parseMeta ?? null) as Json,
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
    p_corrected_name: correctedName ?? undefined,
  })
  if (error) throw error
}

export function confidenceLabel(item: ParsedFoodItem): string | null {
  if (item.source === 'library' || item.source === 'database') return 'baza'
  if (item.confidence === 'high') return 'ok'
  if (item.confidence === 'low' || item.confidence === 'medium') return 'sprawdź'
  return null
}
