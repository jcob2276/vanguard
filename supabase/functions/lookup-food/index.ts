import { corsHeaders } from '../_shared/supabase.ts'

const USDA_API_KEY = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY'

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
  }
}

async function lookupByBarcode(barcode: string): Promise<FoodResult[]> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return []
  const json = await res.json()
  if (json.status !== 1) return []
  const result = offProductToResult(json.product, barcode)
  return result ? [result] : []
}

async function searchOpenFoodFacts(query: string): Promise<FoodResult[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) return []
  const json = await res.json()
  const products = json.products || []
  return products.map((p: any) => offProductToResult(p, p.code || null)).filter(Boolean) as FoodResult[]
}

async function searchUsda(query: string): Promise<FoodResult[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=10`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) return []
  const json = await res.json()
  const foods = json.foods || []
  return foods.map((f: any): FoodResult | null => {
    const nutrients = f.foodNutrients || []
    const get = (name: string) => nutrients.find((n: any) => n.nutrientName === name)?.value ?? null
    return {
      barcode: f.gtinUpc || null,
      name: f.description,
      brand: f.brandOwner || null,
      calories: get('Energy'),
      protein: get('Protein'),
      carbs: get('Carbohydrate, by difference'),
      fat: get('Total lipid (fat)'),
      fiber: get('Fiber, total dietary'),
      sugar: get('Sugars, total including NLEA'),
    }
  }).filter(Boolean) as FoodResult[]
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
      results = await searchOpenFoodFacts(q)
      if (results.length === 0) {
        results = await searchUsda(q)
      }
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
