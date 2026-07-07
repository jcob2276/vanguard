# Reading Order — kanoniczna kolejność czytania dla agentów

> SSOT dla nawigacji po dokumentacji. Każdy inny plik który ma "reading order" powinien cytować ten plik zamiast definiować własną kolejkę.

---

## Quick start (5 minut)

| # | Plik | Co tam jest |
|---|---|---|
| 1 | [`../AGENTS.md`](../AGENTS.md) | Konstytucja, reguły deployu, modele, critical rules |
| 2 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Przepływ danych, crony, podsystemy (jedna strona) |
| 3 | [`../supabase/functions/README.md`](../supabase/functions/README.md) | Rejestr 40 funkcji: status, JWT, tabele, LOC |
| 4 | [`DEV_GUIDE.md`](./DEV_GUIDE.md) | Konwencje, checklista dodawania funkcji, commit convention |
| 5 | [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | Guardrails epistemiczne, feature gate, co jest zablokowane |

## Pełne czytanie (15 minut)

| # | Plik | Co tam jest |
|---|---|---|
| 6 | [`../BACKLOG.md`](../BACKLOG.md) | Co jest odłożone — nie naprawiać czegoś co jest zaplanowane inaczej |
| 6a | [`AUDIT_MASTER_SEQUENCE.md`](./AUDIT_MASTER_SEQUENCE.md) | **Aktywna kolejka audytu 2026-07** — jedyna zsekwencjonowana, zdeduplikowana lista "co robić i w jakiej kolejności". Sprawdź tu PRZED rozpoczęciem jakiejkolwiek pracy z audytu, żeby nie robić czegoś już zrobionego albo poza kolejnością zależności |
| 7 | [`VANGUARD_STATE.md`](./VANGUARD_STATE.md) | Stan aplikacji: zakładki, komponenty, tabele, integracje |
| 8 | [`FEATURE_LIFECYCLE.md`](./FEATURE_LIFECYCLE.md) | Aktywne / disabled / deprecated / dropped |
| 9 | [`PRODUCT_LANGUAGE.md`](./PRODUCT_LANGUAGE.md) | Kanoniczny słownik produktu (Plan, Move, Evidence, itp.) |
| 10 | [`vanguard-core.md`](./vanguard-core.md) | Telegram commands, kluczowe funkcje, tabele — ściągawka |
| 11 | [`TECHNICAL.md`](./TECHNICAL.md) | Głębokie detale: schemat, RPC, znane problemy, temporal status |
| 12 | [`../.cursor/rules/vanguard-context.mdc`](../.cursor/rules/vanguard-context.mdc) | Filozofia, failure modes, co jest zablokowane (Cursor-specific) |
| 13 | [`../.cursor/rules/vanguard-ops.mdc`](../.cursor/rules/vanguard-ops.mdc) | Deploy, secrets, DB constraints (Cursor-specific) |
| 14 | [`../.cursor/rules/vanguard-agent-workflow.mdc`](../.cursor/rules/vanguard-agent-workflow.mdc) | Definition of done, checklist (Cursor-specific) |

## Domenowe (na żądanie)

| Plik | Kiedy czytać |
|---|---|
| [`../lessons.md`](../lessons.md) | Przed każdą sesją — sprawdź czy problem już był |
| [`../supabase/migrations/README.md`](../supabase/migrations/README.md) | Przed dodaniem nowej migracji |
| [`../scripts/README.md`](../scripts/README.md) | Przy uruchamianiu lokalnych skryptów |
| [`runbooks/`](./runbooks/) | Przy incydentach (deploy, bot, DB, Telegram timeout) |
| [`career/`](./career/) | Domena sprzedaż/closer — nie dotyczy Vanguard Core |

## Authority (gdy sprzeczne)

Gdy instrukcje w różnych plikach się różnią, wygrywa plik wyżej na liście:

1. `AGENTS.md` — konstytucja
2. `ARCHITECTURE.md` — data flow
3. `supabase/functions/README.md` — rejestr funkcji
4. Reszta w kolejności powyżej

## Zasada VGM

> Plik > Czat. Instrukcje w plikach, nie w wiadomościach. Agent czyta folder zanim odpowie.
