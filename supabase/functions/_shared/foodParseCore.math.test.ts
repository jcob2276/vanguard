import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  applyUserCorrections,
  applyHomemadeAdjustment,
  enforceMacroMath,
  needsFoodReview,
  caloriesFromMacros,
  type ParsedFoodItem,
} from './foodParseCore.ts'
import { lookupGenericFood, scoreFoodNameMatch } from './foodGeneric.ts'

const llmItem = (overrides: Partial<ParsedFoodItem> = {}): ParsedFoodItem => ({
  name: 'test',
  grams: 100,
  calories: 200,
  protein: 10,
  carbs: 10,
  fat: 10,
  confidence: 'medium',
  source: 'llm',
  ...overrides,
})

Deno.test('enforceMacroMath — koryguje rozjazd >15%', () => {
  const items = enforceMacroMath([llmItem({ calories: 300, protein: 10, carbs: 10, fat: 10 })])
  assertEquals(items[0].calories, caloriesFromMacros(10, 10, 10))
  assertEquals(items[0].confidence, 'low')
})

Deno.test('enforceMacroMath — ciche wyrównanie przy małym rozjazdzi', () => {
  const items = enforceMacroMath([llmItem({ calories: 168, protein: 10, carbs: 10, fat: 10 })])
  assertEquals(items[0].calories, 170)
  assertEquals(items[0].confidence, 'medium')
})

Deno.test('enforceMacroMath — nie dotyka bazy', () => {
  const items = enforceMacroMath([llmItem({ source: 'database', calories: 999, protein: 1, carbs: 1, fat: 1 })])
  assertEquals(items[0].calories, 999)
})

Deno.test('applyHomemadeAdjustment — tylko LLM', () => {
  const out = applyHomemadeAdjustment('naleśniki domowe', [
    llmItem({ source: 'database', fat: 10, calories: 200 }),
    llmItem({ fat: 10, calories: 200, sugar: 10 }),
  ])
  assertEquals(out[0].fat, 10)
  assertEquals(out[1].fat, 9.2)
})

Deno.test('applyUserCorrections — skaluje gramy i ustawia high', () => {
  const out = applyUserCorrections(
    [llmItem({ grams: 100, calories: 200, protein: 20 })],
    [{ query_name: 'test', corrected_name: null, corrected_grams: 150 }],
    'test 150g',
  )
  assertEquals(out[0].grams, 150)
  assertEquals(out[0].calories, 300)
  assertEquals(out[0].confidence, 'high')
})

Deno.test('needsFoodReview — tylko full high auto-save', () => {
  assertEquals(needsFoodReview([llmItem({ confidence: 'high' })]), false)
  assertEquals(needsFoodReview([llmItem({ confidence: 'medium' })]), true)
  assertEquals(needsFoodReview([llmItem({ confidence: 'high' }), llmItem({ confidence: 'medium' })]), true)
})

Deno.test('lookupGenericFood — wątróbka', () => {
  const hit = lookupGenericFood('wątróbka wieprzowa smażona 150g')
  assertEquals(hit?.name, 'Wątróbka wieprzowa smażona')
})

Deno.test('scoreFoodNameMatch — odrzuca słabe OFF-style false positive', () => {
  assertEquals(scoreFoodNameMatch('borówki', 'Ser topiony Borówka'), 0)
  assertEquals(scoreFoodNameMatch('borówki', 'Borówki') > 0.5, true)
})
