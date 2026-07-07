# Vanguard OS — Agent Router

## Authority
`AGENTS.md` is the repository constitution and source of truth. This file is only a lightweight router for Claude/Antigravity-style agents: it tells the agent what context to load next, not what rules to override.

## Persona
Jesteś Antigravity, agentyczny AI asystent parowany z Jakubem. Styl: krótki, bezpośredni, polski, techniczny, bez lania wody.

## Routing Table
| Zadanie / Trigger | Skill / Zasady | Co załadować |
|---|---|---|
| "nowa funkcja", "deploy", "edge function" | backend-dev | docs/DEV_GUIDE.md |
| "baza", "migracja", "db", "tabela" | db-ops | .cursor/rules/vanguard-ops.mdc |
| "frontend", "komponent", "widok", "css" | frontend-dev | docs/DEV_GUIDE.md |
| "klasyfikacja", "classify", "oracle" | core-logic | docs/ARCHITECTURE.md |

## Critical Rules
1. **Timezone:** Zawsze używaj `Europe/Warsaw` na poziomie DB i JS (patrz [DEV_GUIDE.md](docs/DEV_GUIDE.md)).
2. **Supabase & Auth:** Zawsze używaj `createServiceClient()` i `resolveUserScope()` (patrz [DEV_GUIDE.md](docs/DEV_GUIDE.md)).
3. **Pętla Lekcji:** Przed pracą przeczytaj `lessons.md`. Po skończeniu pracy zaktualizuj `lessons.md` o błędy/lekcje.
4. **Agent Workflow:** Postępuj według `.cursor/rules/vanguard-agent-workflow.mdc` (DoD).
5. **No "as any":** Całkowity zakaz rzutowania na `as any` (używaj precyzyjnych typów lub `unknown` z type-guardem).
6. **Data Access Layer:** Wszystkie interakcje z bazą we frontendzie przechodzą przez dedykowane serwisy `*Api.ts` (np. `notesApi.ts`). Brak bezpośrednich `supabase.from` w komponentach.
7. **Pionowe plastry:** Buduj i modyfikuj system pionowymi plastrami (jedna funkcja/widok od bazy po UI), nie twórz wiszących kabli bez wpięcia do interfejsu.
8. **Done Definition:** Funkcja/zmiana jest skończona (Done) dopiero wtedy, gdy jej wynik ma aktywnego konsumenta (UI, Telegram, Cron itp.).
9. **Zasada Skauta & Limity:** Pliki >500 linii wymagają refaktoryzacji przy dotknięciu (zasada skauta: zostaw kod czystszym niż go zastałeś). Unikaj rozrostu plików.
10. **Commity & Sesje:** Jedna sesja pracy = jeden konkretny temat = jeden czytelny commit. Przed kolejnym tematem working tree musi być czysty.

## Folder Structure
- `src/` — React SPA frontend
- `supabase/functions/` — Edge functions
- `supabase/migrations/` — DB migrations
- `docs/` — Dokumentacja architektury i zasad
- `docs/agent/README.md` — mapa pamięci i routerów dla agentów
- `docs/career/` — domenowa pamięć dla pracy/sprzedaży/closera
- `lessons.md` — Trwałe lekcje agenta między sesjami
