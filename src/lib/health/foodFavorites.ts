import { supabase } from '../supabase'
import { unwrapList } from '../supabaseUtils'
import { getYesterdayWarsaw } from '../date'
import { scheduleStrainRecompute } from './strainRefresh'
import { scheduleFoodQualityAnalysis } from './foodLogging'

export interface FoodFavoriteRow {
  id: string
  name: string
  brand: string | null
  barcode: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  default_grams: number
  is_pinned?: boolean
}

/** Per-100g base values; default_grams = typical portion size. */
const FOOD_STAPLES: Omit<FoodFavoriteRow, 'id' | 'barcode'>[] = [
  {
    name: 'Kawa domowa (70mg kofeiny)',
    brand: 'espresso 60ml + 340ml mleko 3.2%',
    calories: 51,
    protein: 2.6,
    carbs: 4,
    fat: 2.7,
    fiber: 0,
    sugar: 4,
    default_grams: 400,
    is_pinned: true,
  },
  {
    name: 'Twaróg 150g',
    brand: 'staple',
    calories: 100,
    protein: 18,
    carbs: 3,
    fat: 2,
    fiber: 0,
    sugar: 2,
    default_grams: 150,
    is_pinned: true,
  },
  {
    name: 'Jajka 3 szt',
    brand: 'staple',
    calories: 155,
    protein: 13,
    carbs: 1,
    fat: 11,
    fiber: 0,
    sugar: 1,
    default_grams: 150,
    is_pinned: true,
  },
]

/** Always-visible quick-add chips in FoodQuickCapture, independent of the user's saved food_favorites rows. */
export const QUICK_CAPTURE_FAVORITES: (Omit<FoodFavoriteRow, 'id' | 'barcode'> & { id: string })[] = [
  {
    id: 'fixed-kawa',
    name: 'Kawa domowa',
    brand: 'espresso 60ml + 340ml mleko 3.2%',
    calories: 51,
    protein: 2.6,
    carbs: 4,
    fat: 2.7,
    fiber: 0,
    sugar: 4,
    default_grams: 400,
    is_pinned: true,
  },
  {
    id: 'fixed-banan',
    name: 'Banan',
    brand: 'staple',
    calories: 89,
    protein: 1.1,
    carbs: 23,
    fat: 0.3,
    fiber: 2.6,
    sugar: 12,
    default_grams: 120,
    is_pinned: true,
  },
  {
    id: 'fixed-odzywka',
    name: 'Odżywka białkowa 25g białka',
    brand: 'staple',
    calories: 380,
    protein: 80,
    carbs: 6,
    fat: 6,
    fiber: 0,
    sugar: 3,
    default_grams: 30,
    is_pinned: true,
  },
]

export async function ensureFoodStaples(userId: string): Promise<void> {
  for (const staple of FOOD_STAPLES) {
    const query = supabase
      .from('food_favorites')
      .select('id, is_pinned, use_count')
      .eq('user_id', userId)
      .eq('name', staple.name);

    if (staple.brand) {
      query.eq('brand', staple.brand);
    } else {
      query.is('brand', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('food_favorites').insert({
        user_id: userId,
        name: staple.name,
        brand: staple.brand,
        calories: staple.calories,
        protein: staple.protein,
        carbs: staple.carbs,
        fat: staple.fat,
        fiber: staple.fiber,
        sugar: staple.sugar,
        default_grams: staple.default_grams,
        is_pinned: true,
        use_count: 0,
      })
      if (error) console.warn('[ensureFoodStaples] insert failed', staple.name, error.message)
      continue
    }

    if ((existing as { use_count: number | null }).use_count === 50) {
      await supabase.from('food_favorites').update({ use_count: 0 }).eq('id', existing.id)
    }

    if (!existing.is_pinned) {
      await supabase.from('food_favorites').update({ is_pinned: true }).eq('id', existing.id)
    }
  }
}

export async function fetchQuickFavorites(userId: string, limit = 8): Promise<FoodFavoriteRow[]> {
  return unwrapList<FoodFavoriteRow>(await supabase
    .from('food_favorites')
    .select('id, name, brand, barcode, calories, protein, carbs, fat, fiber, sugar, default_grams, is_pinned')
    .eq('user_id', userId)
    .order('use_count', { ascending: false })
    .order('is_pinned', { ascending: false })
    .limit(limit))
}

export async function quickAddFavorite(
  userId: string,
  fav: FoodFavoriteRow,
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

export async function repeatYesterdayMeal(
  userId: string,
  targetDate: string,
  mealType: string
): Promise<boolean> {
  const yesterday = getYesterdayWarsaw()
  const { data: entries } = await supabase
    .from('daily_food_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', yesterday)
    .eq('meal_type', mealType)
    .order('logged_at', { ascending: true })

  if (!entries || entries.length === 0) return false

  // Duplicate all entries for this meal type in parallel
  await Promise.all(
    entries.map(async (entry) => {
      const { error } = await supabase.rpc('repeat_food_entry', {
        p_user_id: userId,
        p_source_entry_id: entry.id,
        p_date: targetDate,
      })
      if (error) throw error
    })
  )

  scheduleFoodQualityAnalysis(userId, targetDate)
  scheduleStrainRecompute(userId)
  return true
}
