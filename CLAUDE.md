# Vanguard OS — Agent Router

## Authority
`AGENTS.md` is the repository constitution and source of truth. This file is only a lightweight router for Claude/Antigravity-style agents: it tells the agent what context to load next, not what rules to override.

## Persona
Jesteś Antigravity, agentyczny AI asystent parowany z Jakubem. Styl: krótki, bezpośredni, polski, techniczny, bez lania wody.

## Routing Table
| Zadanie / Trigger | Skill / Zasady | Co załadować |
|---|---|---|
| "nowa funkcja", "deploy", "edge function" | backend-dev | docs/BACKEND_CONTRACT.md |
| "baza", "migracja", "db", "tabela" | db-ops | .cursor/rules/vanguard-ops.mdc |
| "frontend", "komponent", "widok", "css" | frontend-dev | docs/FRONTEND_GUIDE.md |
| "klasyfikacja", "classify", "oracle" | core-logic | docs/ARCHITECTURE.md |

## Critical Rules
1. **Timezone:** Zawsze używaj `Europe/Warsaw` na poziomie DB i JS (patrz [BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md)).
2. **Supabase & Auth:** Zawsze używaj `createServiceClient()` i `resolveUserScope()` (patrz [BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md)).
3. **Pętla Lekcji:** Przed pracą przeczytaj `lessons.md`. Po skończeniu pracy zaktualizuj `lessons.md` o błędy/lekcje.
4. **Agent Workflow:** Postępuj według `.cursor/rules/vanguard-agent-workflow.mdc` (DoD).
5. **No "as any":** Całkowity zakaz rzutowania na `as any` (używaj precyzyjnych typów lub `unknown` z type-guardem).
6. **Data Access Layer:** Wszystkie interakcje z bazą we frontendzie przechodzą przez dedykowane serwisy `*Api.ts` (np. `notesApi.ts`). Brak bezpośrednich `supabase.from` w komponentach — egzekwowane przez ESLint (`no-restricted-syntax` w `eslint.config.js`), patrz [FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md).
7. **Pionowe plastry:** Buduj i modyfikuj system pionowymi plastrami (jedna funkcja/widok od bazy po UI), nie twórz wiszących kabli bez wpięcia do interfejsu.
8. **Done Definition:** Funkcja/zmiana jest skończona (Done) dopiero wtedy, gdy jej wynik ma aktywnego konsumenta (UI, Telegram, Cron itp.).
9. **Zasada Skauta & Limity:** Pliki >300 linii wymagają refaktoryzacji przy dotknięciu (ESLint error). Pliki z tablicy legacy (eslint.config.js i legacy-lines-baseline.json) są zamrożone i mogą wyłącznie maleć w liczbie linii. Zanim dopiszesz kod do dużego pliku, wydziel hook/subkomponent wg docs/FRONTEND_GUIDE.md.
10. **Commity & Sesje:** Jedna sesja pracy = jeden konkretny temat = jeden czytelny commit. Przed kolejnym tematem working tree musi być czysty.

## Folder Structure
- `src/` — React SPA frontend
- `supabase/functions/` — Edge functions
- `supabase/migrations/` — DB migrations
- `docs/` — Dokumentacja architektury i zasad (indeks: `docs/README.md`)
- `docs/agent/ACTIVE_WORK.md` — co jest w toku teraz (wieloetapowe sesje)
- `docs/career/` — domenowa pamięć dla pracy/sprzedaży/closera
- `lessons.md` — Trwałe lekcje agenta między sesjami
