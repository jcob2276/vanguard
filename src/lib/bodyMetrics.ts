/** Scalanie pomiarów z wielu wpisów — ostatnia niepusta wartość per pole. */

export type BodyMetricRow = {
  date?: string | null
  weight?: number | null
  waist?: number | null
  neck?: number | null
  belly?: number | null
  hips?: number | null
  chest?: number | null
  thigh?: number | null
  biceps_l?: number | null
  calf?: number | null
  body_fat?: number | null
}

export type MergedBodySnapshot = {
  asOfDate: string | null
  weight: number | null
  waist: number | null
  neck: number | null
  belly: number | null
  hips: number | null
  chest: number | null
  thigh: number | null
  biceps_l: number | null
  calf: number | null
  body_fat: number | null
}

const MERGE_KEYS: (keyof Omit<MergedBodySnapshot, 'asOfDate'>)[] = [
  'weight', 'waist', 'neck', 'belly', 'hips', 'chest', 'thigh', 'biceps_l', 'calf', 'body_fat',
]

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function mergeLatestBodyMetrics(rows: BodyMetricRow[]): MergedBodySnapshot | null {
  if (!rows.length) return null

  const sorted = [...rows].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  const out: MergedBodySnapshot = {
    asOfDate: sorted[0]?.date ?? null,
    weight: null,
    waist: null,
    neck: null,
    belly: null,
    hips: null,
    chest: null,
    thigh: null,
    biceps_l: null,
    calf: null,
    body_fat: null,
  }

  for (const key of MERGE_KEYS) {
    for (const row of sorted) {
      const v = num(row[key as keyof BodyMetricRow])
      if (v != null) {
        out[key] = v
        break
      }
    }
  }

  return out
}

/** Navy (mężczyźni): brzuch przy pępku, fallback talia. */
export function effectiveWaistForNavy(row: { waist?: number | null; belly?: number | null }): number | null {
  return num(row.belly) ?? num(row.waist)
}

export function navyBodyFatPct(
  waistCm: number,
  neckCm: number,
  heightCm: number,
): number | null {
  const diff = waistCm - neckCm
  if (diff <= 0 || heightCm <= 0) return null
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450
  if (!Number.isFinite(bf)) return null
  return Math.max(3, Math.min(50, Math.round(bf * 10) / 10))
}

export function computeBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null
  return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10
}

export function bodyTrend(
  rows: BodyMetricRow[],
  field: keyof Pick<MergedBodySnapshot, 'weight' | 'waist'>,
): { cur: number; prev: number } | null {
  const withValue = [...rows]
    .filter((r) => num(r[field]) != null)
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
  if (withValue.length < 2) return null
  const cur = num(withValue[withValue.length - 1][field])!
  const prev = num(withValue[withValue.length - 2][field])!
  return { cur, prev }
}

/** Przy upsercie dzisiejszego wiersza — nie nadpisuj pól null wartościami z formularza. */
export function mergeBodyMetricSavePayload(
  today: string,
  userId: string,
  existingToday: BodyMetricRow | null | undefined,
  input: Record<string, string>,
): Record<string, unknown> | null {
  const fields = ['weight', 'waist', 'neck', 'chest', 'belly', 'hips', 'thigh', 'biceps_l', 'calf'] as const
  const out: Record<string, unknown> = { user_id: userId, date: today }
  let anyNew = false

  for (const key of fields) {
    const raw = input[key]
    if (raw !== '') {
      const parsed = num(raw)
      if (parsed != null) {
        out[key] = parsed
        anyNew = true
      }
    } else if (existingToday && num(existingToday[key as keyof BodyMetricRow]) != null) {
      out[key] = num(existingToday[key as keyof BodyMetricRow])
    }
  }

  return anyNew || existingToday ? out : null
}
