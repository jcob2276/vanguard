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
