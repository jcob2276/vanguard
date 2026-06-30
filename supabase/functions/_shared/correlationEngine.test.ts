import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  confidenceTier,
  dualCorrelation,
  interpretR,
  laggedPairs,
  pearson,
  shiftDay,
  spearman,
} from './correlationEngine.ts'

Deno.test('pearson — perfect positive correlation', () => {
  const xy: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]
  const result = pearson(xy)
  assertAlmostEquals(result!.r, 1, 1e-9)
  assertEquals(result!.n, 5)
})

Deno.test('pearson — perfect negative correlation', () => {
  const xy: [number, number][] = [[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]]
  const result = pearson(xy)
  assertAlmostEquals(result!.r, -1, 1e-9)
})

Deno.test('pearson — no variance in x returns null', () => {
  const xy: [number, number][] = [[1, 1], [1, 2], [1, 3]]
  assertEquals(pearson(xy), null)
})

Deno.test('pearson — fewer than 3 points returns null', () => {
  assertEquals(pearson([[1, 1], [2, 2]]), null)
})

Deno.test('spearman — robust to outliers vs pearson', () => {
  // Monotonic but non-linear relationship with one outlier — spearman should stay near 1,
  // pearson gets dragged down by the outlier's magnitude.
  const xy: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 100]]
  const sp = spearman(xy)!
  const pe = pearson(xy)!
  assertAlmostEquals(sp.r, 1, 1e-9)
  if (pe.r >= sp.r) throw new Error(`expected pearson (${pe.r}) < spearman (${sp.r}) under outlier skew`)
})

Deno.test('dualCorrelation — picks spearman when it is meaningfully stronger', () => {
  const xy: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 100]]
  const dual = dualCorrelation(xy)
  assertEquals(dual.method, 'spearman')
  assertEquals(dual.primary, dual.spearman)
})

Deno.test('dualCorrelation — defaults to pearson when comparable', () => {
  const xy: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]
  const dual = dualCorrelation(xy)
  assertEquals(dual.method, 'pearson')
})

Deno.test('shiftDay — shifts calendar date by N days, handles month boundary', () => {
  assertEquals(shiftDay('2026-06-29', 1), '2026-06-30')
  assertEquals(shiftDay('2026-06-30', 1), '2026-07-01')
  assertEquals(shiftDay('2026-06-29', 0), '2026-06-29')
  assertEquals(shiftDay('not-a-date', 1), null)
})

Deno.test('laggedPairs — aligns x[day] with y[day+lag]', () => {
  const x = [{ day: '2026-06-01', value: 10 }, { day: '2026-06-02', value: 20 }]
  const y = [{ day: '2026-06-02', value: 100 }, { day: '2026-06-03', value: 200 }]
  const { pairs, scatter } = laggedPairs(x, y, 1)
  assertEquals(pairs, [[10, 100], [20, 200]])
  assertEquals(scatter.length, 2)
})

Deno.test('laggedPairs — drops unmatched days', () => {
  const x = [{ day: '2026-06-01', value: 10 }]
  const y = [{ day: '2026-06-05', value: 100 }]
  const { pairs } = laggedPairs(x, y, 0)
  assertEquals(pairs, [])
})

Deno.test('confidenceTier — thresholds', () => {
  assertEquals(confidenceTier(3), 'calibrating')
  assertEquals(confidenceTier(5), 'building')
  assertEquals(confidenceTier(11), 'building')
  assertEquals(confidenceTier(12), 'solid')
})

Deno.test('interpretR — direction and strength bands', () => {
  assertEquals(interpretR(0.6), 'silna pozytywna')
  assertEquals(interpretR(-0.6), 'silna negatywna')
  assertEquals(interpretR(0.35), 'umiarkowana pozytywna')
  assertEquals(interpretR(0.15), 'słaba pozytywna')
  assertEquals(interpretR(0.05), 'brak korelacji')
})
