/** Polish reference dishes (PZH-style potrawy). SSOT until full PZH XLSX import. */
import { type GenericFoodPer100g, pickBestGenericMatch } from './foodGeneric.ts'

export const REFERENCE_PL_FOODS: GenericFoodPer100g[] = [
  { name: 'Bigos', calories: 61, protein: 4, carbs: 3, fat: 4 },
  { name: 'Gołąbki', calories: 108, protein: 6, carbs: 9, fat: 5.5 },
  { name: 'Lazania', calories: 132, protein: 8.5, carbs: 12, fat: 5.5 },
  { name: 'Gulasz wołowy', calories: 95, protein: 12, carbs: 3, fat: 4 },
  { name: 'Spaghetti Bolognese', calories: 132, protein: 7, carbs: 18, fat: 3.5 },
  { name: 'Ryba z frytkami', calories: 195, protein: 9.5, carbs: 22, fat: 7.5 },
  { name: 'Hummus', calories: 177, protein: 5, carbs: 14, fat: 11 },
  { name: 'Kebab', calories: 215, protein: 12, carbs: 18, fat: 10.5 },
  { name: 'Sajgonki', calories: 250, protein: 6, carbs: 28, fat: 12.5 },
  { name: 'Sałatka ziemniaczana z majonezem', calories: 143, protein: 1.5, carbs: 12, fat: 10 },
  { name: 'Kotlet schabowy smażony', calories: 270, protein: 17, carbs: 8, fat: 19 },
  { name: 'Kotlet mielony smażony', calories: 250, protein: 16, carbs: 5, fat: 18 },
  { name: 'Pierogi ruskie gotowane', calories: 200, protein: 6, carbs: 35, fat: 4 },
  { name: 'Pizza Margherita', calories: 250, protein: 10, carbs: 30, fat: 10 },
  { name: 'Zupa pomidorowa', calories: 38, protein: 1.2, carbs: 5.5, fat: 1.2 },
  { name: 'Zupa krupnik', calories: 48, protein: 2.5, carbs: 5, fat: 2 },
  { name: 'Rosół', calories: 35, protein: 3.5, carbs: 1, fat: 2 },
  { name: 'Barszcz czerwony', calories: 40, protein: 1.5, carbs: 6, fat: 1 },
  { name: 'Karkówka domowa duszona', calories: 250, protein: 24, carbs: 0, fat: 17 },
  { name: 'Naleśniki z serem', calories: 174, protein: 7, carbs: 22, fat: 6.5 },
  { name: 'Jajecznica', calories: 154, protein: 11, carbs: 1.5, fat: 12 },
  { name: 'Owsianka na mleku', calories: 88, protein: 3.5, carbs: 12, fat: 3 },
]

export function lookupReferencePl(name: string): GenericFoodPer100g | null {
  return pickBestGenericMatch(name, REFERENCE_PL_FOODS)
}
