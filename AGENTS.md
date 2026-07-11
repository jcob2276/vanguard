# AGENTS.md

Entry point for AI agents working in this repository.

## Quick map (read first)

- **Live daily loop:** user stream via `vanguard-telegram` → noon `vanguard-eval-interview` ("Wywiad") → evening `vanguard-daily-reconciliation` reflection. Tomorrow planning is app/Oracle-led, not Telegram evening planning. Autonomous morning brief/ping and legacy midday check are removed.
- **Evidence:** `vanguard_stream` → `vanguard-auto-classify` → `friction_events` → `confirmed_friction_events` (VIEW)
- **Compiled memory:** `vanguard-architect` / `ingest-vault-log` build graph; `vanguard-wiki-compiler` builds derived wiki pages — not inline Oracle chat writes to evidence
- **Function registry (SSOT):** [`supabase/functions/README.md`](supabase/functions/README.md)
- **One-page architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Doc index / reading order:** [`docs/README.md`](docs/README.md) — does not override this constitution.
- **Product language:** [`docs/PRODUCT_LANGUAGE.md`](docs/PRODUCT_LANGUAGE.md) is the canonical vocabulary for UI/docs/agents.
- **Backlog (single file, all open work):** [`BACKLOG.md`](BACKLOG.md)

## Konstytucja (non-negotiable)

1. **System measures behavior. User gives meaning.** Evidence layer ≠ reasoning layer. System mierzy tarcie (friction), odzyskiwanie (recovery) oraz rozpoznaje powtarzalne stany (spirals/momentum).
2. **One write path for friction & recovery:** `vanguard_stream` → `vanguard-auto-classify` only.
3. **Extend, don’t duplicate:** new features plug into existing handlers / README-listed functions — no parallel Telegram clients, no second classify pipeline, no Oracle writes to graph/knowledge on chat turns.
4. **Current-first:** stream 72h beats archive; patterns need explicit N — system może wyciągać wnioski o stanie/trajectory, jeśli opiera je na twardych danych historycznych.
5. **Do not build:** shadow engine, psychoanalytic coaching, undeclared “digital twin” certainty, **ani mechanizmu, w którym system autonomicznie orzeka, że „manifestacja/intencja zadziałała”** (metafizyczna pewność). Deklarowane intencje (modlitwy, afirmacje, cele) są DOZWOLONE jako warstwa **deklaracji** do konfrontacji z zachowaniem (Outcome Continuity). Wiążący jest „Transurfing Layer Guardrail” w [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md), nie blankietowy zakaz.
6. **Problem ostatniej mili:** Feature jest skończony, gdy jego wynik ktoś konsumuje — inaczej nie istnieje. Nie zostawiaj rozgrzebanych kabli i wpięć bez podłączenia do UI/Bota.
7. **Metabolizm, nie hoarding:** System gromadzi dane po to, by je trawić i kondensować (wyciągać beliefs i narrację), a nie archiwizować w nieskończoność szum.

Full guardrails: [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md)

**Wizja długoterminowa (10/10):** [`docs/direction/KIERUNEK.md`](docs/direction/KIERUNEK.md) — North Star / Wersja 10/10.

## What this repo is

Monorepo for **Vanguard** (personal OS) on a Supabase project configured through environment variables.

Local/Supabase sync: edge functions (+ `_shared/`) — exact count and last-verified date live only in [`supabase/functions/README.md`](supabase/functions/README.md) (the registry), not here. Do not copy the number into this file — it goes stale and this file has no mechanism to catch it.

| Subsystem | Purpose | Key paths |
|---|---|---|
| Vanguard Core | Daily loop, stream, oracle, planning, Telegram | `supabase/functions/vanguard-*` |
| Integrations | Oura, Calendar, Strava | `supabase/functions/sync-*`, `supabase/functions/analyze-*` |
| Legacy workout | Original fitness tracking UI/tables | `src/` + `workout_*` tables |

## CRITICAL RULES

```
Deploy:
- Cron/webhook functions MUST deploy with verify_jwt: false (--no-verify-jwt)
- Affected: vanguard-daily-reconciliation,
  vanguard-oracle, vanguard-auto-classify, vanguard-architect,
  vanguard-wiki-compiler,
  ingest-vault-log,
  vanguard-analyst, save-daily-aggregate, vanguard-weekly-synthesis,
  vanguard-eval-interview, vanguard-nutrition-coach,
  sync-strava, rescore-workout-sessions, compute-illness-signal,
  vanguard-librarian, analyze-training-load
- After deploy: `npm run smoke` (or `node scripts/ops/smoke-vanguard.mjs --with-service-role`) + edge logs — no 401

Telegram:
- Vanguard bot: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

DB constraints (verify before INSERT):
- planning_status: pending | active | completed  (NOT 'done')

Edge function gotchas:
- EdgeRuntime.waitUntil does NOT keep background tasks alive after HTTP response
- Telegram webhook timeout: 30s — long voice processing must be synchronous
- vanguard-telegram is a thin router with handlers; change surgically, one flow at a time
- Do NOT store deploy version numbers in rules/docs — they go stale weekly
```

## Where to read next

**SSOT:** [`docs/README.md`](docs/README.md) — kanoniczna kolejność czytania dla agentów (quick start 5 min, pełne czytanie 15 min).

## Reguły dokumentacji

Ten repo miał w lipcu 2026 ponad 20 000 linii dokumentacji w 118 plikach — połowa martwa
(archiwum, ukończone plany sesyjne, zdublowane routery). Konsolidacja 2026-07-11 to
naprawiła; te reguły utrzymują stan naprawiony:

1. **Doc ratchet:** nowy plik `.md` tylko jeśli żaden istniejący nie pasuje. Plan sesyjny/brief
   dla agenta żyje w [`docs/agent/ACTIVE_WORK.md`](docs/agent/ACTIVE_WORK.md) (nadpisywany, nie
   akumulowany) — nie jako nowy plik `FOO_PLAN.md`. Gdy praca się kończy: otwarte punkty
   przenieś do [`BACKLOG.md`](BACKLOG.md), plik planu/brief **skasuj** w tym samym commicie.
2. **Zakaz liczb, które gniją** w ręcznie pisanych dokumentach (liczba edge functions, LOC,
   daty "last verified", numery wersji). Liczby wolno trzymać tylko w plikach generowanych
   (`supabase/functions/README.md`/`FUNCTIONS.md`) albo policzyć na żądanie (`grep`/`wc -l`) —
   nie kopiować jako statyczny tekst gdzie indziej.
3. **Zakaz banerów "STALE — nie ufaj temu plikowi".** Dokument, który sam siebie oznacza jako
   nieaktualny, ma dwie opcje: naprawić w tym samym commicie, albo skasować. Baner bez jednej
   z tych dwóch akcji to szum, nie ostrzeżenie.
4. **Jeden temat = jeden plik.** Zanim dopiszesz sekcję do istniejącego pliku, sprawdź `docs/README.md`
   czy temat już nie ma swojego miejsca wyżej w hierarchii authority — nie twórz równoległego
   pliku "v2"/"10/10"/"FINAL" obok istniejącego. Backlogi/plany łączą się w [`BACKLOG.md`](BACKLOG.md),
   nie mnożą per audyt/sesja.
5. **Holistyczność przy edycji:** przed zmianą pliku dokumentacji przeczytaj go w całości + sprawdź
   `docs/README.md`, czy inny plik nie zawiera tej samej informacji (dubel = przyszła niespójność).
   To samo co Zasada Skauta dla kodu (reguła 9 wyżej), rozciągnięte na dokumentację.

## Models (current)

- Default (most functions): `deepseek-v4-flash` — auto-classify, oracle, architect, wiki-compiler, reconciliation, nutrition-coach, etc.
- Oracle deep mode (`!!`): `deepseek-reasoner`
- Analyst nightly: `deepseek-reasoner` (pattern analysis)
- JSON parsing tasks: `deepseek-chat` — food parsing, workout parsing, food quality, training load, librarian, eval-interview classification. Used where `responseFormat: json_object` is needed (v4-flash uses `reasoning_content` field, not suitable for structured JSON).
- Transcription: OpenAI Whisper (`whisper-1`)
- Embeddings: OpenAI `text-embedding-3-small`

## Current system state

- Evening reconciliation (reflection-only in Telegram) + planning in app/Oracle: **ACTIVE**
- Morning brief/ping + legacy midday check crons: **REMOVED** (functions return 410 stubs); noon interview + evening reflection: **ACTIVE**
- Observation-only mode: **DEPRECATED**
