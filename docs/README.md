# Documentation index & reading order

SSOT dla nawigacji po dokumentacji. Każdy inny plik, który chciałby zdefiniować własną
kolejność czytania albo listę odnośników, powinien zamiast tego cytować ten plik.

## Start here

- [`../CLAUDE.md`](../CLAUDE.md) — router dla Claude/Antigravity-style agentów (persona, routing table)
- [`../AGENTS.md`](../AGENTS.md) — konstytucja repo: quick map, critical rules, reguły dokumentacji
- [`../README.md`](../README.md) — ludzki punkt wejścia (co to za projekt)

## Quick start (5 minut)

| # | Plik | Co tam jest |
|---|---|---|
| 1 | [`../AGENTS.md`](../AGENTS.md) | Konstytucja, reguły deployu, modele, critical rules |
| 2 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Przepływ danych, crony, podsystemy, mapa katalogów (jedna strona) |
| 3 | [`../supabase/functions/README.md`](../supabase/functions/README.md) | Rejestr edge functions: status, JWT, tabele, LOC |
| 4 | [`BACKEND_CONTRACT.md`](./BACKEND_CONTRACT.md) | Twarde reguły deweloperskie i deployu dla backendu i funkcji edge |
| 5 | [`FRONTEND_GUIDE.md`](./FRONTEND_GUIDE.md) | Standardy deweloperskie i zasady projektowe (UX/UI) dla `src/` |
| 6 | [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | Guardrails epistemiczne, feature gate, co jest zablokowane |

## Pełne czytanie (15 minut)

| # | Plik | Co tam jest |
|---|---|---|
| 7 | [`../BACKLOG.md`](../BACKLOG.md) | Jedyny backlog repo: audyt architektury (sekwencja z zależnościami), warstwa wiedzy, bugi/dług techniczny, dług frontendowy, pomysły funkcjonalne. Sprawdź tu PRZED rozpoczęciem pracy z audytu — żeby nie robić czegoś już zrobionego albo poza kolejnością zależności |
| 8 | [`VANGUARD_STATE.md`](./VANGUARD_STATE.md) | Stan aplikacji: zakładki, komponenty, tabele, integracje |
| 9 | [`FEATURE_LIFECYCLE.md`](./FEATURE_LIFECYCLE.md) | Aktywne / disabled / deprecated / dropped |
| 10 | [`PRODUCT_LANGUAGE.md`](./PRODUCT_LANGUAGE.md) | Kanoniczny słownik produktu (Plan, Move, Evidence, itp.) |
| 11 | [`../.cursor/rules/vanguard-context.mdc`](../.cursor/rules/vanguard-context.mdc) | Filozofia, failure modes, co jest zablokowane (Cursor-specific) |
| 12 | [`../.cursor/rules/vanguard-ops.mdc`](../.cursor/rules/vanguard-ops.mdc) | Deploy, secrets, DB constraints (Cursor-specific) |
| 13 | [`../.cursor/rules/vanguard-agent-workflow.mdc`](../.cursor/rules/vanguard-agent-workflow.mdc) | Definition of done, checklist (Cursor-specific) |

## Domenowe (na żądanie)

| Plik | Kiedy czytać |
|---|---|
| [`../lessons.md`](../lessons.md) | Przed każdą sesją — sprawdź czy problem już był |
| [`agent/ACTIVE_WORK.md`](./agent/ACTIVE_WORK.md) | Co jest w toku teraz (wieloetapowe sesje) |
| [`direction/KIERUNEK.md`](./direction/KIERUNEK.md) | North Star / Wersja 10/10 — ocena, czy zmiana przybliża czy oddala od kierunku |
| [`direction/FEATURE_INSPIRATIONS.md`](./direction/FEATURE_INSPIRATIONS.md) | Bank pomysłów funkcjonalnych, posortowany wg dźwigni |
| [`../supabase/migrations/README.md`](../supabase/migrations/README.md) | Przed dodaniem nowej migracji |
| [`../scripts/README.md`](../scripts/README.md) | Przy uruchamianiu lokalnych skryptów |
| [`runbooks/`](./runbooks/) | Przy incydentach (deploy, bot, DB, Telegram timeout) |
| [`surface-contracts/BIOMETRICS.md`](./surface-contracts/BIOMETRICS.md) | Przed zmianą powierzchni biometrycznych (regression checklist) |
| [`career/`](./career/) | Domena sprzedaż/closer — nie dotyczy Vanguard Core |
| [`OPEN_SOURCE.md`](./OPEN_SOURCE.md) | Przed publikacją repo publicznie |

## Authority (gdy sprzeczne)

Gdy instrukcje w różnych plikach się różnią, wygrywa plik wyżej na liście:

1. `AGENTS.md` — konstytucja
2. `ARCHITECTURE.md` — data flow
3. `supabase/functions/README.md` — rejestr funkcji
4. `BACKEND_CONTRACT.md` — dla zmian backendowych
5. `FRONTEND_GUIDE.md` — dla zmian frontendowych i UI/UX
6. Reszta w kolejności powyżej

## Zasada VGM

> Plik > Czat. Instrukcje w plikach, nie w wiadomościach. Agent czyta folder zanim odpowie.
