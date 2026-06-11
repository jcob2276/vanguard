/**
 * reconciliationParser.ts — P2 parser for evening reconciliation responses.
 *
 * Spec (PRODUCT_PRINCIPLES.md §P2 parser):
 *   Użytkownik odpowiada głosówką, nielinearnie, z dygresami.
 *   Parser nie wymusza struktury — wyciąga sygnały gdzie są, resztę zostawia w unparsed_notes.
 *
 * Output fields:
 *   day_score        int 1–5   — "ocena dnia X/10" → normalised
 *   biggest_cost     text      — largest cost/drag of the day
 *   best_move        text      — best action / biggest win
 *   correction       text|null — what did the system misunderstand or miss
 *   resource         text|null — what gave energy / fuelled output
 *   blocker_candidates jsonb[] — raw blockers user named (not classified, just listed)
 *   parse_confidence float     — 0.0–1.0 how sure the parser is
 *   needs_manual_review bool   — true if response was chaotic / ambiguous
 *   unparsed_notes   text|null — remainder that didn't fit any field
 */

import { deepseekChat } from "./deepseek.ts";

export interface P2ParsedResponse {
  day_score: number | null;
  biggest_cost: string | null;
  best_move: string | null;
  correction: string | null;
  resource: string | null;
  blocker_candidates: string[];
  parse_confidence: number;
  needs_manual_review: boolean;
  unparsed_notes: string | null;
  parser_version: string;
}

const PARSER_VERSION = '2026-05-27-v1';

/**
 * Parse an evening reconciliation voice-note response using DeepSeek.
 * Always returns a result — falls back to low-confidence stub on LLM failure.
 */
export async function parseReconciliationResponse(
  userResponse: string,
  deepseekApiKey: string,
  reconciliationQuestions?: string,
): Promise<P2ParsedResponse> {
  const questionsCtx = reconciliationQuestions
    ? `\nPYTANIA KTÓRE DOSTAŁ UŻYTKOWNIK:\n${reconciliationQuestions}\n`
    : '';

  const prompt = `Jesteś parserem wieczornych podsumowań dnia. Użytkownik odpowiada głosówką — nielinearnie, z dygresami, bez struktury.

Twoim zadaniem jest TYLKO wyekstraktować sygnały, które są w odpowiedzi. NIE uzupełniaj, NIE wnioskuj, NIE interpretuj — tylko cytuj lub parafrazuj to co jest.
${questionsCtx}
ZASADY:
- day_score: szukaj "X/10" lub "X/5" lub frazy oceniające dzień → normalizuj do 1–5 (1=fatalny, 5=świetny). null jeśli nie ma.
- biggest_cost: co kosztowało najbardziej, co było największą stratą/dryfu. Maks 150 znaków.
- best_move: najlepsze działanie, najważniejszy sukces. Maks 150 znaków.
- correction: co system źle zrozumiał, co nie pasowało do opisu dnia. null jeśli brak.
- resource: co dało energię, co zasiliło. null jeśli brak lub "nie wiem".
- blocker_candidates: lista surowych blokerów które użytkownik wymienił (NIE klasyfikuj, tylko przepisz). Max 5 elementów.
- parse_confidence: 0.0–1.0 — jak dobrze odpowiedź daje się podzielić na te pola. 0.9=linearna klarowna odpowiedź, 0.3=chaotyczna/za krótka.
- needs_manual_review: true jeśli odpowiedź jest bardzo chaotyczna, za krótka (<30 słów) lub wieloznaczna.
- unparsed_notes: to co nie pasuje do żadnego pola, ale wydaje się ważne. null jeśli brak.

Odpowiedz TYLKO poprawnym JSON (zero markdown, zero komentarzy):

{
  "day_score": null,
  "biggest_cost": "...",
  "best_move": "...",
  "correction": null,
  "resource": null,
  "blocker_candidates": [],
  "parse_confidence": 0.8,
  "needs_manual_review": false,
  "unparsed_notes": null
}

ODPOWIEDŹ UŻYTKOWNIKA:
${userResponse.substring(0, 1000)}`;

  try {
    const { content: raw } = await deepseekChat({
      apiKey: deepseekApiKey,
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
      temperature: 0.05,
      maxTokens: 500,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('[p2-parser] No JSON in DeepSeek response, using fallback');
      return fallbackP2(userResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      day_score:            normalizeScore(parsed.day_score),
      biggest_cost:         truncate(parsed.biggest_cost, 200),
      best_move:            truncate(parsed.best_move, 200),
      correction:           truncate(parsed.correction, 200),
      resource:             truncate(parsed.resource, 200),
      blocker_candidates:   Array.isArray(parsed.blocker_candidates)
        ? parsed.blocker_candidates.slice(0, 5).map((b: any) => String(b).substring(0, 100))
        : [],
      parse_confidence:     clampFloat(parsed.parse_confidence, 0, 1),
      needs_manual_review:  !!parsed.needs_manual_review,
      unparsed_notes:       truncate(parsed.unparsed_notes, 400),
      parser_version:       PARSER_VERSION,
    };
  } catch (err) {
    console.warn('[p2-parser] error, using fallback:', err);
    return fallbackP2(userResponse);
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeScore(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (isNaN(n)) return null;
  // Already in 1-5 range
  if (n >= 1 && n <= 5) return Math.round(n);
  // Convert from 1-10 scale
  if (n >= 1 && n <= 10) return Math.max(1, Math.min(5, Math.round(n / 2)));
  return null;
}

function clampFloat(v: any, min: number, max: number): number {
  const n = Number(v);
  if (isNaN(n)) return (min + max) / 2;
  return Math.max(min, Math.min(max, n));
}

function truncate(v: any, max: number): string | null {
  if (!v || typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t === 'null') return null;
  return t.substring(0, max);
}

/** Fallback when LLM fails — low confidence stub that won't mislead downstream */
function fallbackP2(userResponse: string): P2ParsedResponse {
  const wordCount = userResponse.trim().split(/\s+/).length;
  return {
    day_score:            null,
    biggest_cost:         null,
    best_move:            null,
    correction:           null,
    resource:             null,
    blocker_candidates:   [],
    parse_confidence:     0.0,
    needs_manual_review:  wordCount < 20,
    unparsed_notes:       userResponse.substring(0, 400) || null,
    parser_version:       `${PARSER_VERSION}-fallback`,
  };
}
