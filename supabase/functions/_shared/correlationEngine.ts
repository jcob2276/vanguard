import { studentTPValue } from './stats.ts'

export type SeriesPoint = { day: string; value: number }
export type ScatterPoint = { day: string; x: number; y: number }

export interface CorrelationCore {
  r: number
  n: number
  p: number
  slope: number
  intercept: number
}

export type CorrelationMethod = 'pearson' | 'spearman'

function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}

function pValue(r: number, n: number): number {
  if (n <= 2) return 1
  const oneMinusR2 = 1 - r * r
  if (oneMinusR2 <= 0) return 0
  const t = r * Math.sqrt((n - 2) / oneMinusR2)
  return studentTPValue(t, n - 2)
}

function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++
    const avgRank = (i + j + 2) / 2
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank
    i = j + 1
  }
  return ranks
}

export function pearson(xy: [number, number][]): CorrelationCore | null {
  const n = xy.length
  if (n < 3) return null
  let sumX = 0, sumY = 0
  for (const [x, y] of xy) { sumX += x; sumY += y }
  const meanX = sumX / n, meanY = sumY / n
  let sxx = 0, syy = 0, sxy = 0
  for (const [x, y] of xy) {
    const dx = x - meanX, dy = y - meanY
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy
  }
  if (sxx <= 0 || syy <= 0) return null
  let r = sxy / (Math.sqrt(sxx) * Math.sqrt(syy))
  r = Math.max(-1, Math.min(1, r))
  return { r, n, p: pValue(r, n), slope: sxy / sxx, intercept: meanY - (sxy / sxx) * meanX }
}

export function spearman(xy: [number, number][]): CorrelationCore | null {
  if (xy.length < 3) return null
  const xs = xy.map(p => p[0])
  const ys = xy.map(p => p[1])
  const rx = rankValues(xs)
  const ry = rankValues(ys)
  return pearson(rx.map((x, i) => [x, ry[i]] as [number, number]))
}

export function shiftDay(day: string, delta: number): string | null {
  if (delta === 0) return day
  const d = new Date(day + 'T12:00:00Z')
  if (isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function laggedPairs(
  x: SeriesPoint[],
  y: SeriesPoint[],
  lagDays: number
): { pairs: [number, number][]; scatter: ScatterPoint[] } {
  const mapY: Record<string, number> = {}
  for (const row of y) mapY[row.day] = row.value
  const pairs: [number, number][] = []
  const scatter: ScatterPoint[] = []
  for (const row of [...x].sort((a, b) => a.day.localeCompare(b.day))) {
    const shifted = shiftDay(row.day, lagDays)
    if (shifted && mapY[shifted] != null) {
      pairs.push([row.value, mapY[shifted]])
      scatter.push({ day: row.day, x: row.value, y: mapY[shifted] })
    }
  }
  return { pairs, scatter }
}

export function dualCorrelation(pairs: [number, number][]): {
  pearson: CorrelationCore | null
  spearman: CorrelationCore | null
  method: CorrelationMethod
  primary: CorrelationCore | null
} {
  const pearsonR = pearson(pairs)
  const spearmanR = spearman(pairs)
  let method: CorrelationMethod = 'pearson'
  let primary = pearsonR
  if (pearsonR && spearmanR) {
    if (Math.abs(spearmanR.r) > Math.abs(pearsonR.r) + 0.05) {
      method = 'spearman'
      primary = spearmanR
    }
  } else if (!pearsonR && spearmanR) {
    method = 'spearman'
    primary = spearmanR
  }
  return { pearson: pearsonR, spearman: spearmanR, method, primary }
}

export function interpretR(r: number): string {
  const a = Math.abs(r)
  const dir = r > 0 ? 'pozytywna' : 'negatywna'
  if (a >= 0.5) return `silna ${dir}`
  if (a >= 0.3) return `umiarkowana ${dir}`
  if (a >= 0.1) return `słaba ${dir}`
  return 'brak korelacji'
}

export function confidenceTier(n: number): 'calibrating' | 'building' | 'solid' {
  if (n < 5) return 'calibrating'
  if (n < 12) return 'building'
  return 'solid'
}
