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


