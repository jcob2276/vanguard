#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read
/**
 * Backfill historical NL/LLM food logs:
 * - brand IS NULL only (skips labeled scans)
 * - reconcile macros from food_library → GENERIC_FOODS
 * - enforce 4-4-9 kcal consistency
 *
 * Usage:
 *   deno run --allow-env --allow-net --allow-read scripts/ops/backfill-food-llm-entries.ts
 *   deno run ... scripts/ops/backfill-food-llm-entries.ts --apply
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { lookupGenericFood, scoreFoodNameMatch } from '../../supabase/functions/_shared/foodGeneric.ts'
import {
  caloriesFromMacros,
  enforceMacroMath,
  type ParsedFoodItem,
} from '../../supabase/functions/_shared/foodParseCore.ts'

const APPLY = Deno.args.includes('--apply')
const PAGE = 500

function loadDotEnv(): void {
  try {
    const root = new URL('../../.env', import.meta.url)
    const text = Deno.readTextFileSync(root)
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!Deno.env.get(key)) Deno.env.set(key, val)
    }
  } catch {
    // optional
  }
}

function parseGrams(amount: string | null): number | null {
  if (!amount) return null
  const m = amount.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const n = Math.round(parseFloat(m[1].replace(',', '.')))
  return n > 0 ? n : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function portionFromPer100(grams: number, per100: {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
}) {
  const f = grams / 100
  return {
    calories: Math.round(per100.calories * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
    fiber: per100.fiber != null ? round1(per100.fiber * f) : null,
    sugar: per100.sugar != null ? round1(per100.sugar * f) : null,
  }
}

function isCompoundName(name: string): boolean {
  const n = name.toLowerCase()
  return /\s+(z|ze|i)\s+/.test(n) || n.split(/\s+/).filter(Boolean).length > 4
}

function pickLibraryMatch(name: string, rows: Array<{ name: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber?: number | null; sugar?: number | null }>) {
  let best: typeof rows[number] | null = null
  let bestScore = 0.52
  for (const row of rows) {
    if (row.calories == null || !row.name) continue
    const score = scoreFoodNameMatch(name, row.name)
    if (score > bestScore) {
      bestScore = score
      best = row
    }
  }
  return best
}

function reconcileAllowed(name: string, score: number): boolean {
  if (score >= 0.8) return true
  if (isCompoundName(name)) return false
  return score >= 0.62
}

function pickGenericMatch(name: string) {
  const hit = lookupGenericFood(name)
  if (!hit) return null
  const score = scoreFoodNameMatch(name, hit.name)
  return reconcileAllowed(name, score) ? hit : null
}

interface EntryRow {
  id: string
  user_id: string
  date: string
  name: string
  brand: string | null
  amount: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
}


loadDotEnv()

const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SECRET_KEY')
const userFilter = Deno.env.get('VANGUARD_USER_ID')

if (!url || !key) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SB_SECRET_KEY) in env/.env')
  Deno.exit(1)
}

const supabase = createClient(url, key)

async function fetchLibrary(userId: string) {
  const { data } = await supabase
    .from('food_library')
    .select('name, calories, protein, carbs, fat, fiber, sugar')
    .eq('user_id', userId)
  return data ?? []
}

async function main() {
  console.log(`=== Food LLM backfill ${APPLY ? '(APPLY)' : '(dry-run)'} ===\n`)

  let offset = 0
  let scanned = 0
  let wouldFix = 0
  let fixed = 0
  const affectedDays = new Set<string>()
  const samples: string[] = []

  const libraryCache = new Map<string, Awaited<ReturnType<typeof fetchLibrary>>>()

  while (true) {
    let q = supabase
      .from('daily_food_entries')
      .select('id, user_id, date, name, brand, amount, calories, protein, carbs, fat, fiber, sugar')
      .is('brand', null)
      .order('date', { ascending: false })
      .range(offset, offset + PAGE - 1)

    if (userFilter) q = q.eq('user_id', userFilter)

    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as EntryRow[]
    if (!rows.length) break

    for (const entry of rows) {
      scanned++
      const grams = parseGrams(entry.amount)
      if (!grams) continue

      let per100Source: 'library' | 'database' | null = null
      let per100: { name: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number } | null = null

      if (!libraryCache.has(entry.user_id)) {
        libraryCache.set(entry.user_id, await fetchLibrary(entry.user_id))
      }
      const libHit = pickLibraryMatch(entry.name, libraryCache.get(entry.user_id)!)
      if (libHit?.calories != null && reconcileAllowed(entry.name, scoreFoodNameMatch(entry.name, libHit.name))) {
        per100 = {
          name: libHit.name,
          calories: Number(libHit.calories),
          protein: Number(libHit.protein ?? 0),
          carbs: Number(libHit.carbs ?? 0),
          fat: Number(libHit.fat ?? 0),
          fiber: libHit.fiber != null ? Number(libHit.fiber) : undefined,
          sugar: libHit.sugar != null ? Number(libHit.sugar) : undefined,
        }
        per100Source = 'library'
      } else {
        const generic = pickGenericMatch(entry.name)
        if (generic) {
          per100 = generic
          per100Source = 'database'
        }
      }

      const originalItem: ParsedFoodItem = {
        name: entry.name,
        grams,
        calories: Number(entry.calories ?? 0),
        protein: Number(entry.protein ?? 0),
        carbs: Number(entry.carbs ?? 0),
        fat: Number(entry.fat ?? 0),
        fiber: entry.fiber != null ? Number(entry.fiber) : undefined,
        sugar: entry.sugar != null ? Number(entry.sugar) : undefined,
        confidence: 'medium',
        source: 'llm',
      }

      let item: ParsedFoodItem
      let reason = 'macro_math'
      if (per100 && per100Source) {
        const p = portionFromPer100(grams, per100)
        item = {
          name: per100.name,
          grams,
          ...p,
          carbs: p.carbs,
          fat: p.fat,
          fiber: p.fiber ?? undefined,
          sugar: p.sugar ?? undefined,
          confidence: 'high',
          source: per100Source,
        }
        reason = `reconcile:${per100Source}`

        const oldCal = originalItem.calories
        if (oldCal > 0 && Math.abs(item.calories - oldCal) / oldCal > 0.45) {
          item = originalItem
          reason = 'macro_math_suspicious_reconcile'
        }
      } else {
        item = originalItem
      }

      const [fixedItem] = enforceMacroMath([{ ...item, source: 'llm' }])
      const patch: Record<string, unknown> = {}

      if (fixedItem.name !== entry.name) patch.name = fixedItem.name
      if (fixedItem.calories !== entry.calories) patch.calories = fixedItem.calories
      if (fixedItem.protein !== entry.protein) patch.protein = fixedItem.protein
      if (fixedItem.carbs !== entry.carbs) patch.carbs = fixedItem.carbs
      if (fixedItem.fat !== entry.fat) patch.fat = fixedItem.fat
      if (fixedItem.fiber != null && fixedItem.fiber !== entry.fiber) patch.fiber = fixedItem.fiber
      if (fixedItem.sugar != null && fixedItem.sugar !== entry.sugar) patch.sugar = fixedItem.sugar

      const computed = caloriesFromMacros(fixedItem.protein, fixedItem.carbs, fixedItem.fat)
      if (Object.keys(patch).length === 0) continue

      wouldFix++
      affectedDays.add(`${entry.user_id}:${entry.date}`)

      if (samples.length < 12) {
        samples.push(
          `${entry.date} | ${entry.name} | ${entry.calories}→${fixedItem.calories} kcal (${reason}, computed=${computed})`,
        )
      }

      if (APPLY) {
        const { error: upErr } = await supabase
          .from('daily_food_entries')
          .update(patch)
          .eq('id', entry.id)
        if (upErr) {
          console.error('Update failed', entry.id, upErr.message)
          continue
        }
        fixed++
      }
    }

    offset += PAGE
    if (rows.length < PAGE) break
  }

  if (APPLY && affectedDays.size) {
    for (const key of affectedDays) {
      const [userId, date] = key.split(':')
      await supabase.rpc('_recompute_daily_nutrition', { p_user_id: userId, p_date: date })
    }
  }

  console.log(`Scanned (brand NULL): ${scanned}`)
  console.log(`${APPLY ? 'Fixed' : 'Would fix'}: ${APPLY ? fixed : wouldFix}`)
  console.log(`Affected days: ${affectedDays.size}`)
  if (samples.length) {
    console.log('\nSamples:')
    for (const s of samples) console.log(`  ${s}`)
  }
  if (!APPLY && wouldFix > 0) {
    console.log('\nRe-run with --apply to write changes.')
  }
}

main().catch((e) => {
  console.error(e)
  Deno.exit(1)
})
