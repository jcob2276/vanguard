import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  applyDeclaredPieceCount,
  parseDeclaredPieceCount,
  pieceGramsForName,
} from './foodParseCore.ts'

Deno.test('parseDeclaredPieceCount — 4 naleśniki', () => {
  assertEquals(parseDeclaredPieceCount('4 naleśniki z białym serem od babci domowe'), 4)
})

Deno.test('applyDeclaredPieceCount — skaluje 200g → 300g dla 4 naleśników', () => {
  const items = applyDeclaredPieceCount('4 naleśniki z serem', [{
    name: 'naleśnik z białym serem',
    grams: 200,
    calories: 340,
    protein: 18,
    carbs: 40,
    fat: 12,
    confidence: 'medium',
    source: 'llm',
  }])
  assertEquals(items[0].grams, 300)
  assertEquals(items[0].calories, 510)
})

Deno.test('pieceGramsForName — naleśnik', () => {
  assertEquals(pieceGramsForName('naleśnik z serem'), 75)
})
