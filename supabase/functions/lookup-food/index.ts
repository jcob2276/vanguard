/**
 * @function lookup-food
 * @trigger HTTP POST / Frontend / manual
 * @role Wyszukiwanie makroskładników produktów spożywczych (baza lokalna + API zewnętrzne jak Open Food Facts).
 * @reads —
 * @writes —
 * @calls Open Food Facts API (external)
 * @consumer Modal dodawania jedzenia (FoodEntryModal) w aplikacji
 * @status active
 */
import { serveJson } from '../_shared/http.ts'
import { GENERIC_FOODS, searchGenericFoods, pickBestGenericMatch } from '../_shared/foodGeneric.ts'
import { lookupReferencePl } from '../_shared/foodReferencePl.ts'

const OFF_USER_AGENT = 'VanguardOS/1.0 (personal nutrition log)'

interface FoodResult {
  barcode: string | null
  name: string
  brand: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  defaultGrams: number | null
  source?: 'generic' | 'reference_pl' | 'off'
  incomplete?: boolean
}

function toFoodResult(f: typeof GENERIC_FOODS[number], source: FoodResult['source']): FoodResult {
  return {
    name: f.name,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    fiber: f.fiber ?? null,
    sugar: f.sugar ?? null,
    barcode: null,
    brand: null,
    defaultGrams: null,
    source
  }
}

function searchGeneric(query: string): FoodResult[] {
  const wordMatches = searchGenericFoods(query).map((f) => toFoodResult(f, 'generic'))
  if (wordMatches.length) return wordMatches
  const best = pickBestGenericMatch(query, GENERIC_FOODS)
  return best ? [toFoodResult(best, 'generic')] : []
}

function searchReferencePl(query: string): FoodResult[] {
  const best = lookupReferencePl(query)
  if (!best) return []
  return [toFoodResult(best, 'reference_pl')]
}

// OFF's `serving_size`/`quantity` are free-text ("250 ml", "1 sztuka (30g)") —
// pull out the leading number, which is all we need for a sane portion default.
function parseLeadingGrams(value: unknown): number | null {
  if (typeof value !== 'string') return null
  // Prefer grams in parentheses: "1 sztuka (30g)" → 30
  const parenG = value.match(/\((\d+(?:[.,]\d+)?)\s*g\)/i)
  if (parenG) {
    const n = parseFloat(parenG[1].replace(',', '.'))
    return n > 0 ? Math.round(n) : null
  }
  const m = value.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  return n > 0 ? Math.round(n) : null
}

// Prefer the product's stated single serving (what you'd actually eat/drink at
// once — a 250ml bottle, a 30g serving of cereal) over the whole-package
// quantity, which is frequently far too large to be a sane logging default
// (e.g. a 1kg bag of rice). Falls back to package quantity only when OFF has
// no serving_size at all — better than always defaulting to 100g/ml.
function extractDefaultGrams(product: any): number | null {
  const fromServing = parseLeadingGrams(product?.serving_size)
  if (fromServing) return fromServing
  if (typeof product?.product_quantity === 'number' && product.product_quantity > 0) {
    return Math.round(product.product_quantity)
  }
  return parseLeadingGrams(product?.quantity)
}

function offProductToResult(product: any, barcode: string | null): FoodResult | null {
  const n = product?.nutriments
  if (!product?.product_name || !n) return null
  return {
    barcode,
    name: product.product_name,
    brand: product.brands || null,
    calories: n['energy-kcal_100g'] != null ? Math.round(n['energy-kcal_100g']) : null,
    protein: n['proteins_100g'] ?? null,
    carbs: n['carbohydrates_100g'] ?? null,
    fat: n['fat_100g'] ?? null,
    fiber: n['fiber_100g'] ?? null,
    sugar: n['sugars_100g'] ?? null,
    defaultGrams: extractDefaultGrams(product),
    source: 'off',
    incomplete: n['energy-kcal_100g'] == null,
  }
}

// OFF is volunteer-run and occasionally throws transient 5xx under load —
// one retry after a short backoff smooths that over without masking real failures.
async function fetchOffWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400))
    try {
      const res = await fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT }, signal: AbortSignal.timeout(22000) })
      if (res.ok) return res
      console.warn(`[lookup-food] OFF attempt ${attempt + 1} -> ${res.status}`)
    } catch (err: unknown) {
      console.warn(`[lookup-food] OFF attempt ${attempt + 1} threw:`, err instanceof Error ? err.message : String(err))
    }
  }
  return null
}

async function lookupOneBarcode(barcode: string): Promise<FoodResult | null> {
  const res = await fetchOffWithRetry(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`)
  if (!res) return null
  const json = await res.json()
  if (json.status !== 1) return null
  return offProductToResult(json.product, barcode)
}

// Camera scanners sometimes emit UPC-A (12 digits) for a barcode OFF only has
// indexed as EAN-13 (13 digits, leading 0), or vice versa — a real and common
// cause of "scanned but not found" even though the product exists. Try the
// scanned code first, then the zero-padded/stripped variant before giving up.
async function lookupByBarcode(barcode: string): Promise<FoodResult[]> {
  const direct = await lookupOneBarcode(barcode)
  if (direct) return [direct]

  let altCode: string | null = null
  if (barcode.length === 12) altCode = `0${barcode}`
  else if (barcode.length === 13 && barcode.startsWith('0')) altCode = barcode.slice(1)

  if (altCode) {
    const alt = await lookupOneBarcode(altCode)
    if (alt) return [alt]
  }
  return []
}

async function searchOpenFoodFacts(query: string): Promise<{ results: FoodResult[]; status: 'ok' | 'unavailable'; incompleteCount: number }> {
  // Restricting to Polish-language products keeps foreign (often French, since OFF
  // started there) listings out of results for a Polish-only user.
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&tagtype_0=languages&tag_contains_0=contains&tag_0=polish`
  const res = await fetchOffWithRetry(url)
  if (!res) return { results: [], status: 'unavailable', incompleteCount: 0 }
  const json = await res.json()
  const products = json.products || []
  const mapped = products.map((p: any) => offProductToResult(p, p.code || null)).filter(Boolean) as FoodResult[]
  const complete = mapped.filter((product) => !product.incomplete)
  return { results: complete, status: 'ok', incompleteCount: mapped.length - complete.length }
}

Deno.serve(serveJson(async (req) => {
  const url = new URL(req.url)
  const barcode = url.searchParams.get('barcode')
  const q = url.searchParams.get('q')

  if (barcode) {
    const results = await lookupByBarcode(barcode)
    return { results, status: 'ok', incompleteCount: results.filter((item) => item.incomplete).length }
  }
  if (q) {
    const refPl = searchReferencePl(q)
    const generic = searchGeneric(q)
    const off = await searchOpenFoodFacts(q)
    return {
      results: [...refPl, ...generic, ...off.results],
      status: off.status,
      incompleteCount: off.incompleteCount,
    }
  }
  throw new Error('Provide barcode or q')
}, { auth: 'none' }))
