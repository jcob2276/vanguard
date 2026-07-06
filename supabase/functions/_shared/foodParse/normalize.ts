import type { ParsedFoodItem, FoodParseMeta } from "../foodParseCore.ts";
import { normalizePl } from "./matching.ts";

export const PARSER_VERSION = '2026-06-28';

function parseConfidence(value: unknown): 'high' | 'medium' | 'low' {
  const v = String(value || '').toLowerCase();
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}

function parseAssumptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((a) => String(a).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export function normalizeGramOnlyItems(raw: unknown): ParsedFoodItem[] {
  const parsed = typeof raw === 'string'
    ? JSON.parse(raw)
    : (raw && typeof raw === 'object' ? raw as Record<string, unknown> : null);

  if (!parsed) return [];

  const rawItems: unknown[] = Array.isArray(parsed.items)
    ? parsed.items as unknown[]
    : Array.isArray(parsed)
    ? parsed as unknown[]
    : [];

  return rawItems
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const name = String(item.name || '').trim();
      if (!name) return null;

      const grams = Math.max(1, Math.round(Number(item.grams) || 100));
      const assumptions = parseAssumptions(item.assumptions);

      const result: ParsedFoodItem = {
        name,
        grams,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidence: parseConfidence(item.confidence),
        source: 'llm',
        parseMeta: { macroSource: 'llm_estimate', parserVersion: PARSER_VERSION },
      };
      if (assumptions) result.assumptions = assumptions;
      return result;
    })
    .filter((item): item is ParsedFoodItem => item != null && item.name.length > 0);
}

export function isUnmatchedForMacros(item: ParsedFoodItem): boolean {
  return item.source === 'llm'
    && item.calories === 0
    && item.protein === 0
    && item.carbs === 0
    && item.fat === 0;
}

export function normalizeRawItems(raw: unknown): ParsedFoodItem[] {
  const parsed = typeof raw === 'string'
    ? JSON.parse(raw)
    : (raw && typeof raw === 'object' ? raw as Record<string, unknown> : null);

  if (!parsed) return [];

  const rawItems: unknown[] = Array.isArray(parsed.items)
    ? parsed.items as unknown[]
    : Array.isArray(parsed)
    ? parsed as unknown[]
    : [];

  return rawItems
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const name = String(item.name || '').trim();
      if (!name) return null;

      const grams = Math.max(1, Math.round(Number(item.grams) || 100));
      const calories = Math.max(0, Math.round(Number(item.calories) || 0));
      const protein = Math.max(0, Math.round(Number(item.protein) * 10) / 10);
      const carbs = Math.max(0, Math.round(Number(item.carbs ?? 0) * 10) / 10);
      const fat = Math.max(0, Math.round(Number(item.fat ?? 0) * 10) / 10);

      const result: ParsedFoodItem = {
        name,
        grams,
        calories,
        protein,
        carbs,
        fat,
        confidence: parseConfidence(item.confidence),
        source: 'llm',
        parseMeta: { macroSource: 'llm_estimate', parserVersion: PARSER_VERSION },
      };

      if (item.fiber != null) {
        result.fiber = Math.max(0, Math.round(Number(item.fiber) * 10) / 10);
      }
      if (item.sugar != null) {
        result.sugar = Math.max(0, Math.round(Number(item.sugar) * 10) / 10);
      }
      const assumptions = parseAssumptions(item.assumptions);
      if (assumptions) result.assumptions = assumptions;

      return result;
    })
    .filter((item): item is ParsedFoodItem => item != null && item.name.length > 0);
}

interface GuardrailRule {
  keywords: string[];
  maxGrams: number;
  defaultGrams: number;
}

const NUTRITION_GUARDRAILS: GuardrailRule[] = [
  { keywords: ['maslo', 'masla'], maxGrams: 35, defaultGrams: 10 },
  { keywords: ['olej', 'oleju', 'rzepakow', 'slonecznik'], maxGrams: 35, defaultGrams: 10 },
  { keywords: ['oliwa', 'oliwy'], maxGrams: 35, defaultGrams: 10 },
  { keywords: ['sol', 'soli'], maxGrams: 10, defaultGrams: 2 },
  { keywords: ['cukier', 'cukru'], maxGrams: 50, defaultGrams: 10 },
  { keywords: ['maslo orzechowe', 'masla orzechowego'], maxGrams: 60, defaultGrams: 20 },
];

export function applyPhysiologicalGuardrails(items: ParsedFoodItem[], originalText: string): ParsedFoodItem[] {
  const normText = normalizePl(originalText);

  return items.map((item) => {
    const normName = normalizePl(item.name);
    for (const rule of NUTRITION_GUARDRAILS) {
      const matches = rule.keywords.some((kw) => normName.includes(kw));
      if (matches && item.grams > rule.maxGrams) {
        // Sprawdź czy użytkownik wpisał ilość jawnie (np. "50g masła", "masło 50g")
        const explicitePattern = new RegExp(`(\\d+)\\s*(?:g|gram\\w*|szt\\w*)\\s*(?:${rule.keywords.join('|')})|(?:${rule.keywords.join('|')})\\s*(\\d+)`, 'i');
        const isExplicite = explicitePattern.test(normText);

        if (!isExplicite) {
          const originalGrams = item.grams;
          const adjustedGrams = rule.defaultGrams;
          const scale = adjustedGrams / originalGrams;

          return {
            ...item,
            grams: adjustedGrams,
            calories: Math.round(item.calories * scale),
            protein: Math.round(item.protein * scale * 10) / 10,
            carbs: Math.round(item.carbs * scale * 10) / 10,
            fat: Math.round(item.fat * scale * 10) / 10,
            fiber: item.fiber != null ? Math.round(item.fiber * scale * 10) / 10 : undefined,
            sugar: item.sugar != null ? Math.round(item.sugar * scale * 10) / 10 : undefined,
            confidence: 'low',
            assumptions: [
              ...(item.assumptions ?? []),
              `guardrail: przycięto gramaturę ${item.name} z ${originalGrams}g do ${adjustedGrams}g (brak explicite w opisie)`,
            ],
          };
        }
      }
    }
    return item;
  });
}

/** Auto-save only when every line is high-confidence (baza / explicite gramy / poprawka). */
export function needsFoodReview(items: ParsedFoodItem[]): boolean {
  if (!items.length) return false;
  return items.some((i) => i.confidence !== 'high');
}

const MACRO_MISMATCH_TOLERANCE = 0.15;

export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function enforceMacroMath(items: ParsedFoodItem[]): ParsedFoodItem[] {
  return items.map((item) => {
    if (item.source !== 'llm') return item;

    const computed = caloriesFromMacros(item.protein, item.carbs, item.fat);
    if (computed <= 0) return item;

    const diff = Math.abs(computed - item.calories) / Math.max(computed, item.calories);
    if (diff <= MACRO_MISMATCH_TOLERANCE) {
      if (item.calories !== computed) {
        return { ...item, calories: computed };
      }
      return item;
    }

    return {
      ...item,
      calories: computed,
      confidence: 'low',
      assumptions: [
        ...(item.assumptions ?? []),
        `kalorie skorygowane z B/W/T (model podał ${item.calories} kcal, niezgodne z makro)`,
      ],
    };
  });
}
