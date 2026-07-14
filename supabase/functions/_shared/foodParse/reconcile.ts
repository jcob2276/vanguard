import { deepseekChat, parseJsonFromContent } from "../deepseek.ts";
import { LLM_TASKS } from "../llm/tasks.ts";
import { lookupGenericFood, scoreFoodNameMatch } from "../foodGeneric.ts";
import { lookupReferencePl } from "../foodReferencePl.ts";
import type { ParsedFoodItem, UserParseContext, FoodCorrection } from "../foodParseCore.ts";
import { normalizePl, scaleParsedItem } from "./matching.ts";
import { isUnmatchedForMacros, normalizeRawItems, PARSER_VERSION } from "./normalize.ts";
import { buildSystemPrompt } from "./prompts.ts";

const MIN_RECONCILE_SCORE = 0.52;

interface Per100gFood { name: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber?: number | null; sugar?: number | null; source?: 'generic' | 'reference_pl' | 'off'; }
export type ReconcileOpts = { supabaseUrl: string; serviceKey: string; userId?: string; db?: unknown; apiKey?: string };

function pickBestMatchScored(query: string, results: Per100gFood[]): { match: Per100gFood; score: number } | null {
  if (!results.length) return null;
  let best: Per100gFood | null = null, bestScore = MIN_RECONCILE_SCORE;
  for (const r of results) { if (r.calories == null || !r.name) continue; const score = scoreFoodNameMatch(query, r.name); if (score > bestScore) { bestScore = score; best = r; } }
  return best ? { match: best, score: bestScore } : null;
}

function findCorrectionForItem(item: ParsedFoodItem, corrections: FoodCorrection[], originalText: string, itemCount: number): FoodCorrection | null {
  const itemNorm = normalizePl(item.name);
  for (const c of corrections) { const q = normalizePl(c.query_name); if (!q) continue; if (itemNorm.includes(q) || q.includes(itemNorm)) return c; }
  if (itemCount === 1) { const textNorm = normalizePl(originalText); for (const c of corrections) { const q = normalizePl(c.query_name); if (q && textNorm.includes(q)) return c; } }
  return null;
}

export function applyUserCorrections(items: ParsedFoodItem[], corrections: FoodCorrection[] | undefined, originalText: string): ParsedFoodItem[] {
  if (!corrections?.length) return items;
  return items.map((item) => {
    const c = findCorrectionForItem(item, corrections, originalText, items.length);
    if (!c) return item;
    const newGrams = Math.max(1, c.corrected_grams);
    const scaled = newGrams !== item.grams ? scaleParsedItem(item, newGrams / item.grams) : item;
    return { ...scaled, name: c.corrected_name?.trim() || item.name, grams: newGrams, confidence: 'high', source: 'library', parseMeta: { macroSource: 'user_correction', matchedName: c.corrected_name?.trim() || item.name, parserVersion: PARSER_VERSION }, assumptions: [...(item.assumptions ?? []), `poprawka użytkownika: ${newGrams}g`] };
  });
}

function splitCompoundName(name: string): [string, string] | null {
  const parts = normalizePl(name).split(/\s+(?:z|ze)\s+/);
  if (parts.length !== 2) return null;
  const [a, b] = parts.map((p) => p.trim());
  if (a.length < 3 || b.length < 3) return null;
  return [a, b];
}

function titleCasePl(fragment: string): string { const t = fragment.trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : fragment; }

export async function tryExpandCompoundItems(items: ParsedFoodItem[], opts: ReconcileOpts): Promise<ParsedFoodItem[]> {
  if (items.length !== 1 || !isUnmatchedForMacros(items[0])) return items;
  const split = splitCompoundName(items[0].name);
  if (!split) return items;
  const [mainRaw, secRaw] = split;
  const totalGrams = items[0].grams;
  const mainGrams = Math.max(1, Math.round(totalGrams * 0.82));
  const secGrams = Math.max(1, totalGrams - mainGrams);
  const base = items[0];
  const [rMain, rSec] = await Promise.all([reconcileOne({ ...base, name: titleCasePl(mainRaw), grams: mainGrams }, opts), reconcileOne({ ...base, name: titleCasePl(secRaw), grams: secGrams }, opts)]);
  if (rMain.source === 'llm' && isUnmatchedForMacros(rMain) && rSec.source === 'llm' && isUnmatchedForMacros(rSec)) return items;
  const assumption = `rozbite na składniki (${mainGrams}g + ${secGrams}g)`;
  return [{ ...rMain, assumptions: [...(rMain.assumptions ?? []), assumption] }, { ...rSec, assumptions: [...(rSec.assumptions ?? []), assumption] }];
}

function recalcFromPer100g(grams: number, per100: Per100gFood) {
  const f = grams / 100, r = (n: number) => Math.round(n * 10) / 10;
  return { calories: Math.round(Number(per100.calories) * f), protein: r(Number(per100.protein ?? 0) * f), carbs: r(Number(per100.carbs ?? 0) * f), fat: r(Number(per100.fat ?? 0) * f), fiber: per100.fiber != null ? r(Number(per100.fiber) * f) : undefined, sugar: per100.sugar != null ? r(Number(per100.sugar) * f) : undefined };
}

async function lookupOffFast(name: string): Promise<{ match: Per100gFood; score: number; macroSource: 'off' } | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5&tagtype_0=languages&tag_contains_0=contains&tag_0=polish`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'VanguardOS/1.0' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json() as { products?: Array<{ product_name?: string; nutriments?: Record<string, number> }> };
    const results: Per100gFood[] = (json.products ?? []).filter((p) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null).map((p) => ({ name: p.product_name!, calories: Math.round(Number(p.nutriments!['energy-kcal_100g'])), protein: p.nutriments!['proteins_100g'] ?? 0, carbs: p.nutriments!['carbohydrates_100g'] ?? 0, fat: p.nutriments!['fat_100g'] ?? 0, fiber: p.nutriments!['fiber_100g'], sugar: p.nutriments!['sugars_100g'], source: 'off' as const }));
    const picked = pickBestMatchScored(name, results);
    return picked ? { match: picked.match, score: picked.score, macroSource: 'off' } : null;
  } catch { return null; }
}

async function verifyMatchWithLLM(query: string, candidate: string, apiKey: string): Promise<boolean> {
  try {
    const res = await deepseekChat({
      apiKey,
      ...LLM_TASKS.structured,
      responseFormat: undefined,
      temperature: 0,
      maxTokens: 5,
      timeoutMs: 5000,
      messages: [{ role: 'user', content: `Czy "${query}" odpowiada "${candidate}"? TAK lub NIE.` }]
    });
    return res.content.trim().toUpperCase().includes('TAK');
  } catch { return true; }
}

async function lookupViaLibraryRaw(name: string, userId: string, db: any): Promise<Per100gFood[] | null> {
  const { data, error } = await db.from('food_library').select('name, calories, protein, carbs, fat, fiber, sugar').eq('user_id', userId).ilike('name', `%${name}%`).limit(10);
  if (error || !data?.length) return null;
  return data as Per100gFood[];
}

async function reconcileOne(item: ParsedFoodItem, opts: ReconcileOpts): Promise<ParsedFoodItem> {
  let match: Per100gFood | null = null;
  let source: ParsedFoodItem['source'] = 'llm';
  let macroSource: any = 'llm_estimate';
  let matchScore: number | undefined;
  let matchedName: string | undefined;

  if (opts.userId && opts.db) { const lib = pickBestMatchScored(item.name, (await lookupViaLibraryRaw(item.name, opts.userId, opts.db)) ?? []); if (lib) { match = lib.match; source = 'library'; macroSource = 'library'; matchScore = lib.score; matchedName = lib.match.name; } }
  if (!match?.calories) { const ref = lookupReferencePl(item.name); if (ref) { match = ref; source = 'database'; macroSource = 'reference_pl'; matchedName = ref.name; matchScore = scoreFoodNameMatch(item.name, ref.name); } }
  if (!match?.calories) { const local = lookupGenericFood(item.name); if (local) { match = local; source = 'database'; macroSource = 'generic'; matchedName = local.name; matchScore = scoreFoodNameMatch(item.name, local.name); } }
  if (!match?.calories) { const remote = await lookupOffFast(item.name); if (remote?.match.calories != null) { match = remote.match; source = 'database'; macroSource = remote.macroSource; matchScore = remote.score; matchedName = remote.match.name; } }
  if (matchScore != null && matchScore >= 0.50 && matchScore <= 0.72 && opts.apiKey && matchedName) { const ok = await verifyMatchWithLLM(item.name, matchedName, opts.apiKey); if (!ok) { match = null; source = 'llm'; macroSource = 'llm_estimate'; matchScore = undefined; matchedName = undefined; } }
  if (match?.calories != null && source !== 'llm') { return { ...item, ...recalcFromPer100g(item.grams, match), name: match.name || item.name, confidence: 'high', source, assumptions: item.assumptions, parseMeta: { macroSource, matchScore, matchedName, parserVersion: PARSER_VERSION } }; }
  return item;
}

export async function reconcileItems(items: ParsedFoodItem[], opts: ReconcileOpts): Promise<ParsedFoodItem[]> { return Promise.all(items.map((item) => reconcileOne(item, opts))); }

export async function callParseLLM(apiKey: string, system: string, userText: string, maxTokens?: number): Promise<unknown> {
  const result = await deepseekChat({
    apiKey,
    ...LLM_TASKS.structured,
    maxTokens: maxTokens ?? 1200,
    timeoutMs: 32000,
    messages: [{ role: 'system', content: system }, { role: 'user', content: userText }]
  });
  return parseJsonFromContent(result.content);
}

export async function fillMacrosLlmFallback(items: ParsedFoodItem[], apiKey: string, ctx: UserParseContext, originalText: string): Promise<ParsedFoodItem[]> {
  const indices = items.map((item, i) => (isUnmatchedForMacros(item) ? i : -1)).filter((i) => i >= 0);
  if (!indices.length) return items;
  const payload = indices.map((i) => ({ name: items[i].name, grams: items[i].grams }));
  const macrosRaw = await callParseLLM(apiKey, buildSystemPrompt(ctx, 'macros_only'), `Oblicz makro dla produktów:\n${JSON.stringify(payload, null, 2)}\n\nOryginalny opis: "${originalText}"`, 1200);
  const macroItems = normalizeRawItems(macrosRaw);
  const out = [...items];
  for (let j = 0; j < indices.length; j++) {
    const idx = indices[j];
    const macro = macroItems[j] ?? macroItems.find((m) => normalizePl(m.name).includes(normalizePl(out[idx].name)));
    if (!macro) continue;
    out[idx] = { ...out[idx], calories: macro.calories, protein: macro.protein, carbs: macro.carbs, fat: macro.fat, fiber: macro.fiber, sugar: macro.sugar, confidence: macro.confidence === 'high' ? 'medium' : macro.confidence, source: 'llm', assumptions: [...(out[idx].assumptions ?? []), ...(macro.assumptions ?? []), 'makro szacowane — brak w bazie'], parseMeta: { macroSource: 'llm_estimate', parserVersion: PARSER_VERSION } };
  }
  return out;
}
