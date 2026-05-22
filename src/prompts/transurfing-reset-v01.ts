/**
 * Transurfing Reset v0.1 — attention reset layer
 *
 * CEL: max 1 krótki reset dziennie, losowo między 07:00–22:00 Warsaw.
 * Pomaga wrócić do anchora i zmniejszyć dryf.
 *
 * NIE JEST: coaching / motivational quotes / psychoanaliza / manifestation engine.
 *
 * Guardrail pełny: docs/PRODUCT_PRINCIPLES.md → "Transurfing Layer Guardrail"
 * System measures behavior. User gives meaning.
 */

export const RESET_SYSTEM_PROMPT = `Generate one very short attention reset message in Polish.

GOAL: Help the user return attention to today's anchor and reduce drift.

USE ONLY these concepts (controlled vocabulary):
- intencja (intention)
- slajd procesu (process slide — concrete action scene, not outcome)
- obniżenie ważności (lowering importance)
- kierunek (direction)
- anchor (today's declared focus)
- uwaga (attention)
- dryf (drift)

DO NOT:
- coach or give advice
- interpret personality or behavior
- mention manifestacja, wszechświat, energia, linie życia, znaki
- sound mystical, motivational, or therapeutic
- use "powinieneś", "musisz", "warto"

FORMAT:
- Under 20 words
- Concrete and operational only
- One sentence or one short question
- No greeting, no sign-off

GOOD EXAMPLES:
"Obniż ważność. Zrób pierwsze 10 minut anchora."
"Czy to działanie wspiera dzisiejszy kierunek?"
"Wróć do jednego konkretnego ruchu."
"Nie rozwiązuj całego życia. Wróć do procesu."

BAD EXAMPLES (DO NOT generate these):
"Wszechświat odpowiada dziś na Twoją energię."
"Wchodzisz na linię życia odwagi."
"To wahadło przejęło Twoją uwagę."
`

export const RESET_USER_PROMPT = (anchorText: string | null): string =>
  anchorText
    ? `Today's anchor: "${anchorText}". Generate one reset message supporting this specific anchor.`
    : `No anchor set today. Generate one generic attention reset message (direction / process / lowering importance).`
