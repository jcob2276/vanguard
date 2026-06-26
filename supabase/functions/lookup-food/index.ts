import { corsHeaders } from '../_shared/supabase.ts'

const OFF_USER_AGENT = 'Vanguard-OS/1.0 (personal nutrition tracker; contact: newsletter.jakub@gmail.com)'

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
}

// OFF is a barcode/packaged-product database — it's structurally thin on plain
// generic foods (boiled potatoes, raw vegetables, cooked grains) since nobody
// scans a barcode for those. This is a small curated table of the staples most
// people actually eat day to day, checked before OFF so they always resolve
// to clean Polish-only per-100g data instead of "Brak wyników" or a stray
// branded/foreign product.
const GENERIC_FOODS: FoodResult[] = [
  { name: 'Ziemniaki gotowane', calories: 87, protein: 1.9, carbs: 20, fat: 0.1, fiber: 1.8, sugar: 0.8 },
  { name: 'Ziemniaki pieczone', calories: 93, protein: 2.1, carbs: 21.2, fat: 0.1, fiber: 2.1, sugar: 1.2 },
  { name: 'Ryż biały gotowany', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1 },
  { name: 'Ryż brązowy gotowany', calories: 123, protein: 2.6, carbs: 25.6, fat: 1, fiber: 1.6, sugar: 0.4 },
  { name: 'Kasza gryczana gotowana', calories: 92, protein: 3.4, carbs: 19.9, fat: 0.6, fiber: 2.7, sugar: 0.6 },
  { name: 'Kasza jęczmienna gotowana', calories: 123, protein: 2.3, carbs: 28.2, fat: 0.4, fiber: 3.8, sugar: 0.3 },
  { name: 'Makaron gotowany', calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, sugar: 0.6 },
  { name: 'Jajko kurze ugotowane', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sugar: 1.1 },
  { name: 'Kurczak pierś pieczona bez skóry', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 },
  { name: 'Indyk pierś', calories: 135, protein: 29, carbs: 0, fat: 1, fiber: 0, sugar: 0 },
  { name: 'Wołowina mielona smażona 15% tłuszczu', calories: 254, protein: 26, carbs: 0, fat: 17, fiber: 0, sugar: 0 },
  { name: 'Łosoś pieczony', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0 },
  { name: 'Tuńczyk w wodzie', calories: 116, protein: 26, carbs: 0, fat: 1, fiber: 0, sugar: 0 },
  { name: 'Ogórek świeży', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sugar: 1.7 },
  { name: 'Pomidor świeży', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6 },
  { name: 'Sałata', calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, sugar: 0.8 },
  { name: 'Papryka czerwona świeża', calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sugar: 4.2 },
  { name: 'Brokuł gotowany', calories: 35, protein: 2.4, carbs: 7, fat: 0.4, fiber: 3.3, sugar: 1.7 },
  { name: 'Marchew świeża', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7 },
  { name: 'Cebula', calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2 },
  { name: 'Banan', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 },
  { name: 'Jabłko', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4 },
  { name: 'Awokado', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7 },
  { name: 'Truskawki', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, sugar: 4.9 },
  { name: 'Mleko 2%', calories: 50, protein: 3.4, carbs: 4.8, fat: 2, fiber: 0, sugar: 4.8 },
  { name: 'Jogurt naturalny', calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, sugar: 4.7 },
  { name: 'Twaróg półtłusty', calories: 137, protein: 18, carbs: 3.7, fat: 5, fiber: 0, sugar: 3.7 },
  { name: 'Ser żółty', calories: 350, protein: 25, carbs: 2, fat: 27, fiber: 0, sugar: 0.5 },
  { name: 'Masło', calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sugar: 0.1 },
  { name: 'Oliwa z oliwek', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0 },
  { name: 'Chleb pszenny', calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sugar: 4 },
  { name: 'Chleb żytni', calories: 250, protein: 7, carbs: 48, fat: 1.5, fiber: 5.8, sugar: 1.4 },
  { name: 'Płatki owsiane', calories: 379, protein: 13, carbs: 67, fat: 7, fiber: 10, sugar: 1 },
  { name: 'Migdały', calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, sugar: 4.4 },
  { name: 'Orzechy włoskie', calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, sugar: 2.6 },
  { name: 'Soczewica gotowana', calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 1.8 },
  { name: 'Ciecierzyca gotowana', calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, sugar: 4.8 },
  { name: 'Fasola czerwona gotowana', calories: 127, protein: 8.7, carbs: 23, fat: 0.5, fiber: 6.4, sugar: 0.3 },
  { name: 'Tofu', calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, sugar: 0.6 },
  { name: 'Miód', calories: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, sugar: 82 },
].map((f) => ({ ...f, barcode: null, brand: null, defaultGrams: null }))

function normalizePl(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź|ż/g, 'z')
}

function searchGeneric(query: string): FoodResult[] {
  const qWords = normalizePl(query).split(/\s+/).filter(Boolean)
  if (qWords.length === 0) return []
  return GENERIC_FOODS.filter((f) => {
    const name = normalizePl(f.name)
    return qWords.every((w) => name.includes(w))
  })
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
  }
}

// OFF is volunteer-run and occasionally throws transient 5xx under load —
// one retry after a short backoff smooths that over without masking real failures.
async function fetchOffWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400))
    try {
      const res = await fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT }, signal: AbortSignal.timeout(15000) })
      if (res.ok) return res
      console.warn(`[lookup-food] OFF attempt ${attempt + 1} -> ${res.status}`)
    } catch (err) {
      console.warn(`[lookup-food] OFF attempt ${attempt + 1} failed:`, err)
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

async function searchOpenFoodFacts(query: string): Promise<FoodResult[]> {
  // Restricting to Polish-language products keeps foreign (often French, since OFF
  // started there) listings out of results for a Polish-only user.
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&tagtype_0=languages&tag_contains_0=contains&tag_0=polish`
  const res = await fetchOffWithRetry(url)
  if (!res) return []
  const json = await res.json()
  const products = json.products || []
  return products.map((p: any) => offProductToResult(p, p.code || null)).filter(Boolean) as FoodResult[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const barcode = url.searchParams.get('barcode')
    const q = url.searchParams.get('q')

    let results: FoodResult[] = []

    if (barcode) {
      results = await lookupByBarcode(barcode)
    } else if (q) {
      const generic = searchGeneric(q)
      const off = await searchOpenFoodFacts(q)
      results = [...generic, ...off]
    } else {
      return new Response(JSON.stringify({ error: 'Provide barcode or q' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[lookup-food] error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
