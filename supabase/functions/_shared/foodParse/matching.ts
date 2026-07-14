import type { ParsedFoodItem } from "../foodParseCore.ts";

const COMPLEX_MEAL_RE = /\b(obiad|restaurac|u mamy|potrawa domow|karkowka domow|bigos domow)\b/i;

/** Waga 1 szt. — do przeliczania "4 naleśniki" → grams łącznie. */
const PIECE_GRAMS_RULES: Array<{ test: (n: string) => boolean; grams: number; label: string }> = [
  { test: (n) => /nalesnik|placek|racuch/.test(n), grams: 75, label: 'naleśnik/placki' },
  { test: (n) => /\bjaj/.test(n), grams: 60, label: 'jajko' },
  { test: (n) => /pierog/.test(n), grams: 55, label: 'pieróg' },
  { test: (n) => /kromk/.test(n), grams: 35, label: 'kromka chleba' },
  { test: (n) => /\bbul/.test(n), grams: 55, label: 'bułka' },
  { test: (n) => /plaster/.test(n), grams: 18, label: 'plasterek' },
];

export function normalizePl(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź|ż/g, 'z');
}

export function pieceGramsForName(name: string): number | null {
  const n = normalizePl(name);
  for (const rule of PIECE_GRAMS_RULES) {
    if (rule.test(n)) return rule.grams;
  }
  return null;
}

/** "4 naleśniki", "3 jajka", "2x pieróg" → liczba sztuk z tekstu użytkownika. */
export function parseDeclaredPieceCount(text: string): number | null {
  const n = normalizePl(text);
  const m = n.match(
    /\b(\d{1,2})\s*(?:x\s*)?(?:szt\.?\s*)?(?:nalesnik\w*|placek\w*|racuch\w*|jaj\w*|pierog\w*|kromk\w*|bul\w*|plaster\w*)/,
  );
  if (!m) return null;
  const count = parseInt(m[1], 10);
  return count >= 2 && count <= 24 ? count : null;
}

export function scaleParsedItem(item: ParsedFoodItem, factor: number): ParsedFoodItem {
  if (factor <= 0 || !Number.isFinite(factor) || Math.abs(factor - 1) < 0.04) return item;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    ...item,
    grams: Math.max(1, Math.round(item.grams * factor)),
    calories: Math.max(0, Math.round(item.calories * factor)),
    protein: round1(item.protein * factor),
    carbs: round1(item.carbs * factor),
    fat: round1(item.fat * factor),
    fiber: item.fiber != null ? round1(item.fiber * factor) : undefined,
    sugar: item.sugar != null ? round1(item.sugar * factor) : undefined,
  };
}

/** Jeśli user napisał "4 naleśniki", a LLM zwrócił porcję na ~1–2 szt. — skaluj w górę. */
export function applyDeclaredPieceCount(text: string, items: ParsedFoodItem[]): ParsedFoodItem[] {
  const count = parseDeclaredPieceCount(text);
  if (!count || items.length !== 1) return items;

  const perPiece =
    pieceGramsForName(items[0].name) ??
    pieceGramsForName(text);
  if (!perPiece) return items;

  const targetGrams = count * perPiece;
  const item = items[0];
  const assumption = `${count} szt. × ~${perPiece}g ≈ ${targetGrams}g łącznie`;

  if (item.grams < targetGrams * 0.85) {
    const factor = targetGrams / item.grams;
    const scaled = scaleParsedItem(item, factor);
    return [{
      ...scaled,
      confidence: item.confidence === 'high' ? 'medium' : item.confidence,
      assumptions: [...(item.assumptions ?? []), assumption],
    }];
  }

  if (item.grams <= targetGrams * 1.25) {
    return [{
      ...item,
      assumptions: [...(item.assumptions ?? []), assumption],
    }];
  }

  return items;
}

function isHomemadeContext(text: string): boolean {
  const n = normalizePl(text);
  return /\b(domow\w*|wlasn\w*|babci|babcia|mamy|tesciow\w*|gotowane w domu)\b/.test(n);
}

/** Domowe ≈ mniej cukru/tłuszczu niż paczka/restauracja — tylko dla szacunków LLM. */
export function applyHomemadeAdjustment(text: string, items: ParsedFoodItem[]): ParsedFoodItem[] {
  if (!isHomemadeContext(text)) return items;

  return items.map((item) => {
    if (item.source !== 'llm') return item;
    const sugarBefore = item.sugar ?? 0;
    const fatBefore = item.fat;
    const sugar = item.sugar != null ? Math.round(item.sugar * 0.88 * 10) / 10 : undefined;
    const fat = Math.round(item.fat * 0.92 * 10) / 10;
    const sugarSaved = item.sugar != null ? (sugarBefore - (sugar ?? 0)) * 4 : 0;
    const fatSaved = (fatBefore - fat) * 9;
    const calories = Math.max(0, Math.round(item.calories - sugarSaved - fatSaved));
    return {
      ...item,
      sugar,
      fat,
      calories,
      assumptions: [
        ...(item.assumptions ?? []),
        'domowe — lekko niższy cukier/tłuszcz niż wersja sklepowa/restauracyjna',
      ],
    };
  });
}

export function isComplexMeal(text: string): boolean {
  if (text.length > 120) return true;
  if (COMPLEX_MEAL_RE.test(text)) return true;
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 4;
}
