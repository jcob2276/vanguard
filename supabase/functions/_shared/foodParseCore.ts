import {
  applyDeclaredPieceCount,
  applyHomemadeAdjustment,
  isComplexMeal,
} from "./foodParse/matching.ts";
import {
  applyPhysiologicalGuardrails,
  enforceMacroMath,
  normalizeGramOnlyItems,
  PARSER_VERSION,
} from "./foodParse/normalize.ts";
import {
  applyUserCorrections,
  callParseLLM,
  fillMacrosLlmFallback,
  reconcileItems,
  tryExpandCompoundItems,
} from "./foodParse/reconcile.ts";
import { buildSystemPrompt } from "./foodParse/prompts.ts";

export { PARSER_VERSION } from "./foodParse/normalize.ts";
export {
  pieceGramsForName,
  parseDeclaredPieceCount,
  applyDeclaredPieceCount,
  isHomemadeContext,
  applyHomemadeAdjustment,
  normalizePl,
  isComplexMeal,
} from "./foodParse/matching.ts";
export { buildSystemPrompt } from "./foodParse/prompts.ts";
export {
  normalizeGramOnlyItems,
  isUnmatchedForMacros,
  normalizeRawItems,
  applyPhysiologicalGuardrails,
  needsFoodReview,
  caloriesFromMacros,
  enforceMacroMath,
} from "./foodParse/normalize.ts";
export {
  applyUserCorrections,
  reconcileItems,
  callParseLLM,
} from "./foodParse/reconcile.ts";

export interface FoodParseMeta {
  macroSource: 'library' | 'generic' | 'reference_pl' | 'off' | 'llm_estimate' | 'user_correction'
  matchScore?: number
  matchedName?: string
  parserVersion: string
}

export interface ParsedFoodItem {
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  confidence: 'high' | 'medium' | 'low'
  source: 'llm' | 'database' | 'library'
  assumptions?: string[]
  parseMeta?: FoodParseMeta
}

export interface UserParseContext {
  profileLine: string
  targetKcal: number | null
  targetProtein: number | null
  favoritesBlock: string
  correctionsBlock: string
  historyBlock: string
  portionsBlock: string
}

export interface FoodCorrection {
  query_name: string
  corrected_name: string | null
  corrected_grams: number
}

export interface FinalizeFoodParseOpts {
  originalText: string
  corrections?: FoodCorrection[]
  supabaseUrl: string
  serviceKey: string
  userId?: string
  db?: unknown
  apiKey?: string
  parseContext?: UserParseContext
}

export async function parseMealText(
  apiKey: string,
  text: string,
  ctx: UserParseContext,
): Promise<ParsedFoodItem[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  // LLM: name + grams only. Makro liczy kod z bazy (RAG), nie model.
  const gramsRaw = await callParseLLM(
    apiKey,
    buildSystemPrompt(ctx, 'grams_only'),
    `Parsuj: "${trimmed}"`,
    isComplexMeal(trimmed) ? 1200 : 800,
  )
  let items = normalizeGramOnlyItems(gramsRaw)
  items = applyDeclaredPieceCount(trimmed, items)
  return items
}

/**
 * Canonical post-LLM pipeline — single entry point for parse-food-nl.
 * Order: corrections → reconcile → compound split → homemade → macro math.
 */
export async function finalizeParsedItems(
  items: ParsedFoodItem[],
  opts: FinalizeFoodParseOpts,
): Promise<ParsedFoodItem[]> {
  const reconcileOpts = {
    supabaseUrl: opts.supabaseUrl,
    serviceKey: opts.serviceKey,
    userId: opts.userId,
    db: opts.db,
    apiKey: opts.apiKey,
  }

  let out = applyUserCorrections(items, opts.corrections, opts.originalText)
  out = await reconcileItems(out, reconcileOpts)
  out = await tryExpandCompoundItems(out, reconcileOpts)

  if (opts.apiKey && opts.parseContext) {
    out = await fillMacrosLlmFallback(out, opts.apiKey, opts.parseContext, opts.originalText)
  }

  out = applyHomemadeAdjustment(opts.originalText, out)
  out = applyPhysiologicalGuardrails(out, opts.originalText)
  out = enforceMacroMath(out)
  return out
}
