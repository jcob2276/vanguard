# BACKEND CONTRACT — twarde zasady dla agentów

> **Egzekwowane mechanicznie przez `npm run ratchet:backend`** (`scripts/ops/check-backend-contract.mjs` + `backend-contract-baseline.json`).
> Reguła bez mechanizmu nie istnieje — jeśli dodajesz regułę do tego pliku, dodaj licznik do skryptu w tym samym commicie.
> Ostatnia weryfikacja z kodem: **2026-07-12**.

---

## 0. Definicje (bez interpretacji)

**ZAWSZE** = zero wyjątków bez jawnego wpisu w tym pliku. "Tym razem szybciej będzie inline" nie jest wyjątkiem — jest naruszeniem kontraktu. Wyjątki mają nazwaną listę (sekcja 2), wszystko poza listą to dług liczony przez ratchet.

**Funkcja (kod) jest SKOŃCZONA**, gdy wszystkie poniższe są prawdą:
1. Wynik ma **aktywnego konsumenta** (UI / Telegram / cron / inna funkcja) — zapis, którego nikt nie czyta, to atrapa.
2. Po deployu **liczniki w tabelach docelowych rosną** — sprawdzone `SELECT count(*)`, nie JSON-em response funkcji (funkcja umie kłamać, tabela nie).
3. Auth przetestowany w obie strony: anon dostaje 401 tam, gdzie ma dostać, user dostaje 200 tam, gdzie UI go wysyła. **Konsolidacja/zmiana auth = grep wszystkich konsumentów** (`src/`, `cron.job`, inne funkcje) w tym samym zadaniu.
4. `npm run ratchet:backend` przechodzi, `npm run smoke` przechodzi, registry (`npm run registry:generate`) bez mismatchy.
5. JSDoc nagłówek funkcji (`@trigger/@reads/@writes/@consumer`) zgodny z rzeczywistością — z niego generuje się FUNCTIONS.md.

**DONE dla całej zmiany** = powyższe + jedna sesja / jeden temat / jeden commit + wpis w `lessons.md` jeśli był błąd po drodze.

---

## 1. Kernel — niczego z tej tabeli nie piszesz samemu

Potrzebujesz X → importujesz Y. Napisanie własnej wersji = duplikat = naruszenie.

| Potrzebujesz | Import | Zakazany odpowiednik |
|---|---|---|
| Cały handler HTTP (OPTIONS/CORS/auth/error-logging/JSON framing) | `serveJson(handler, {auth})` z `_shared/http.ts` — handler zwraca zwykłą wartość (auto-wrap 200 JSON) albo `Response` (przepuszczana bez zmian, dla webhooków/streamingu) | ręczny `if (req.method==='OPTIONS')`, ręczny `try/catch` + `new Response(JSON.stringify(...))` |
| Klient DB | `createServiceClient()` z `_shared/supabase.ts` | `createClient(...)` inline |
| Auth: cron / DB-trigger | `requireServiceRole(req)` z `_shared/auth.ts` | ręczne porównanie nagłówka |
| Auth: wywołanie z UI (też mixed) | `resolveUserScope(req, userId)` z `_shared/supabase.ts` | brak auth / własny check |
| Data "dziś" Warsaw | `getWarsawDateString()` z `@vanguard/domain` (re-export `_shared/time.ts`) | inline `toLocaleDateString(... Europe/Warsaw)` |
| Zakresy dnia / cutoffy streamu | `getWarsawDayBoundaries`, `getStreamCutoffs` z `_shared/time.ts` | ręczna arytmetyka na `Date` |
| LLM DeepSeek | `deepseekChat()` / `deepseekStream()` z `_shared/deepseek.ts` | raw `fetch(api.deepseek.com)` |
| JSON z odpowiedzi LLM | `parseJsonFromContent()` z `_shared/deepseek.ts` | regex / `JSON.parse` na surowym content |
| OpenAI (embeddings, chat, Whisper) | `_shared/openai.ts` / `transcribeVoice` z `_shared/infra/telegram/send.ts` | raw `fetch(api.openai.com)` |
| Telegram Bot API | `_shared/telegram.ts` (`sendMessage`, `answerCallbackQuery`, ...) | raw `fetch(api.telegram.org)` |
| Kontekst streamu (72h/21d) | `_shared/streamContext.ts` | własny `.from('vanguard_stream')` z limitami |
| Błąd krytyczny do audytu | `logCriticalError()` z `_shared/errorLogging.ts` | goły `console.error` i cisza |
| Sekrety service-role | wewnątrz kernela (`supabase.ts`/`auth.ts`) | `Deno.env.get('SB_SECRET_KEY')` w handlerze |
| Wynik zapytania z throw | `safeExecute(query)` — **zwraca `data` bezpośrednio, nie destrukturyzuj `{data}`** | `try/catch` bez sprawdzenia `{error}` |

Zasady przy zapisach bez `safeExecute`: po **każdym** `.insert()/.update()/.upsert()` sprawdź `{ error }` i rzuć. Supabase JS **nie throwuje** na błędzie Postgres/RLS. Handler, który robi `console.error(error)` i zwraca sukces, to cicha porażka — najczęstszy bug w historii tego repo (lessons.md: 5 wystąpień).

---

## 2. Zakazy z licznikami (stan 2026-07-12 — po sesji domykającej `/goal` 10/10)

Ratchet pilnuje, żeby liczby **nigdy nie rosły**. Zmniejszyłeś — obniż baseline w tym samym commicie.

| Zakaz | Stan | Docelowo |
|---|---|---|
| `createClient(` poza kernelem | **0** | 0 (twarde) — osiągnięte |
| raw `fetch` do telegram/openai/deepseek poza `_shared` | **4** | udokumentowany wyjątek bootstrap (patrz niżej) |
| inline `toLocaleDateString(` w funkcjach | **9** | udokumentowany wyjątek — formatowanie do wyświetlenia, nie generatory dat |
| `as any` w `supabase/functions/` | **0** | 0 (twarde) — osiągnięte |
| `new Response(JSON.stringify(...))` zamiast helpera | **4** | teoretyczne minimum — 3 to kanoniczne definicje `serveJson`/`requireServiceRole` w kernelu, 1 mały leaf-helper (`_shared/infra/telegram/send.ts`) |
| `SB_SECRET_KEY` poza kernelem | **4** | udokumentowany wyjątek — service-to-service auth (patrz niżej) |
| Pliki > 300 linii | **0** (poza `_shared/database.types.ts`, generowany, zwolniony) | 0 — osiągnięte |

Wszystkie funkcje edge przechodzą przez `serveJson` (`_shared/http.ts`) — jednolity
CORS/OPTIONS/auth/error-logging. Handler może zwrócić zwykłą wartość (JSON-wrapowana
automatycznie) LUB instancję `Response` (przepuszczaną bez zmian — dla webhooków,
streamingu, czy niestandardowych statusów, które faktycznie sprawdza jakiś caller).

Nazwane wyjątki (jedyne legalne):
- `_shared/vanguardCore.ts` ma prywatną kopię date-helpera (zero-dependency by design, opisane w nagłówku pliku).
- Endpointy setup w `vanguard-telegram/index.ts` (setWebhook/setMyCommands) mogą wołać Telegram API bezpośrednio — to bootstrap, nie runtime.
- `vanguard-telegram/index.ts` i `_router/config.ts` czytają `SB_SECRET_KEY` jako fallback dla admin-only utility branches (setup_commands/fix_webhook) i do budowy kontekstu routera — service-to-service auth, nie duplikacja.
- `parse-food-nl/index.ts` czyta `SUPABASE_SERVICE_ROLE_KEY` do przekazania jako bearer token przy wywołaniu innej funkcji edge (nie do tworzenia klienta DB).

Dodatkowe zakazy bez licznika (łapane na review):
- **HTTP 200 z `{ error }`** przy realnej porażce — błąd to 4xx/5xx. Wyjątek: handlery DB-trigger (outbox, worker), które zwracają 200 żeby pg_net nie retryował — ale wtedy failure MUSI iść do `logCriticalError` + status w tabeli kolejki.
- `EdgeRuntime.waitUntil` dla zapisów, które muszą się skończyć przed odpowiedzią.
- Nowa tabela bez migracji + RLS; DROP kolumny bez grepa po `src/` i `supabase/functions/` (0 wierszy z wartością ≠ martwa kolumna).
- Drugi pipeline friction / drugi klient Telegram / zapis Oracle do grafu na turze czatu (konstytucja, `AGENTS.md`).

---

## 3. Modele LLM — jedna tabela prawdy

| Zadanie | Model | Uwaga |
|---|---|---|
| Klasyfikacja / syntezy / chat | `deepseek-v4-flash` | domyślny |
| **Structured JSON** (`responseFormat: json_object`) | `deepseek-chat` | v4-flash oddaje wynik w `reasoning_content` — patrz lessons 2026-06-21 |
| Deep analysis (Oracle `!!`, analyst nightly) | `deepseek-reasoner` | drogi, tylko na żądanie |
| Embeddings | `text-embedding-3-small` | zgodność wektorów w DB |
| Transkrypcja | `whisper-1` | — |

**Rozstrzygnięte 2026-07-12**: `vanguard-auto-classify` (`handlers/classify.ts`) używa `v4-flash` +
`json_object` i działa poprawnie — zweryfikowano empirycznie: 0 zdarzeń
`classify_parse_fallback`/`friction_parse_fallback` w `audit_events` za ostatnie 30 dni,
realne zróżnicowane kategorie w `vanguard_stream` (Duch/Ciało/Chaos/Relacje/Konto, nie same
"Chaos" które sygnalizowałoby stały fallback). Ostrzeżenie z lessons 2026-06-21 dotyczyło
innej sytuacji lub wcześniejszej wersji modelu — nieaktualne dla obecnego stanu. Zasada w
tabeli wyżej ("Structured JSON → `deepseek-chat`") zostaje jako bezpieczny domyślny wybór
dla NOWEGO kodu, ale `v4-flash`+`json_object` nie jest już traktowane jako automatyczny bug.

---

## 4. Architektura wzorcowa (10/10) — do czego zmierzamy

```
packages/domain/          czysta logika (daty, statystyka, fitness) — zero IO, testowalna w Vitest i Deno
supabase/functions/
  _shared/
    http.ts                serveJson — JEDYNY sposób obsługi HTTP (CORS/OPTIONS/auth/error-logging/framing)
    supabase.ts, auth.ts  kernel dostępu i auth (JEDYNE miejsce z kluczami)
    infra/                cały świat zewnętrzny: deepseek, openai, telegram (JEDYNE fetch'e wychodzące)
    nightly/              kroki pipeline'u jako czyste funkcje (ctx) => result, bez parsowania Request
    streamContext.ts      kanoniczne odczyty gorących tabel
  <funkcja>/
    index.ts              CIENKI router: auth → parse → dispatch → response (< 100 linii)
    handlers/*.ts         jedna akcja = jeden plik (< 300 linii)
    prompts.ts            prompty LLM osobno od logiki
```

Zasady kierunkowe:
1. **`index.ts` to router, nie program.** Logika żyje w `handlers/`, prompty w `prompts.ts`. Wzór: `vanguard-telegram` (webhook 188 linii + handlery), antywzór: `vanguard-wiki-compiler` (776 linii w jednym pliku).
2. **Kroki pipeline przyjmują parametry, nie `Request`.** Odtwarzanie `new Request(...)` żeby przekazać body dalej (obecny `vanguard-nightly`) to zapach — sub-krok ma dostać `{ supabase, userId, date }`.
3. **DB jest interfejsem odczytu dla UI.** Frontend czyta tabele wynikowe; edge function wywołuje się tylko po to, żeby coś ZMIENIĆ. Przeliczanie korelacji przy każdym otwarciu zakładki = błąd architektury.
4. **Auth matrix**: cron/trigger → `requireServiceRole`; UI → `verify_jwt=true` albo `resolveUserScope`; router akcji mixed → `resolveUserScope` (service key przechodzi). Czwartego wzorca nie ma.
5. **Jedno źródło konfiguracji deploy**: `config.toml` = produkcja. Funkcja niezadeklarowana w `config.toml` nie istnieje.

---

## 5. Molochy — stan: 0 (zweryfikowane 2026-07-12)

Wszystkie pliki z historycznej mapy rozbicia zostały rozbite ≤300 linii w sesjach
2026-07-11/12 (patrz `BACKEND_10_10_PLAN.md`). Aktualny stan całego `supabase/functions/`:
**zero plików >300 linii** poza `_shared/database.types.ts` (generowany przez
`supabase gen types`, świadomie zwolniony w `GENERATED_FILES` w
`scripts/ops/check-backend-contract.mjs` — rośnie ze schematem, to nie dług).

Najbliższe do limitu (dla świadomości, nie akcji — żaden nie wymaga podziału):
`vanguard-wiki-compiler/compiler.ts` (299), `vanguard-oracle/oracle/rag.ts` (299),
`vanguard-telegram/_handlers/savedLinks.ts` (298), `_shared/correlationSeries.ts` (295).

**Zasada nadal obowiązuje**: przy DOTKNIĘCIU pliku, który przekroczy 300 linii — wydziel
moduł, obniż baseline. Nie dopisuj do rosnącego pliku bez podziału.

---

## 6. Dodawanie do bazy danych i RLS

1. **Migracje jako jedyna droga**: Wszystkie nowe tabele lub modyfikacje istniejących (ALTER/CREATE) wykonujemy wyłącznie przez pliki migracji w `supabase/migrations/YYYYMMDDHHMMSS_opis.sql`. Nigdy bezpośrednio przez Dashboard.
2. **RLS od razu**: Każda nowa tabela musi otrzymać Row Level Security (RLS) oraz polityki bezpieczeństwa:
   ```sql
   ALTER TABLE nowa_tabela ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users own their data" ON nowa_tabela FOR ALL USING (auth.uid() = user_id);
   CREATE POLICY "Service role bypass" ON nowa_tabela FOR ALL TO service_role USING (true);
   ```
3. **Weryfikacja constraintów**: Przed zaimplementowaniem zapisu z poziomu kodu upewnij się, jakie ograniczenia (constraints) i enumy obowiązują w DB (np. `planning_status` to `pending | active | completed`, a nie `done`).

---

## 7. Zasady deployu i wyłączania kodu

1. **Deploy Guard**: Zalecana ścieżka deployu to:
   ```powershell
   node scripts/ops/deploy-guard.mjs <function-name>
   ```
   Deploy sprawdza czyste drzewo Git i rejestruje wdrożenie.
2. **Weryfikacja po deployu**: Zawsze uruchom `npm run smoke` (lub `npm run smoke:safe` przy leaf-funkcjach) i sprawdzaj logi produkcyjne przez 5 minut. Zero błędów 401/404.
3. **Ustawienia `verify_jwt`**:
   - Webhooki, webhook Telegrama i crony -> `verify_jwt = false` w `config.toml` (oraz dodaj do listy w `AGENTS.md`).
   - Standardowe wywołania z frontend UI -> `verify_jwt = true`.
4. **Wyłączanie kodu (nie kasowanie)**: Jeśli wyłączasz feature tymczasowo, skomentuj kod z opisem daty, autora i powodu:
   ```typescript
   // DISABLED — Sprint 0.7 (2026-05-17)
   // Powód: LLM mutował source-of-truth bez guardrails.
   // Re-enable w Sprint 1 z explicit temporal guards.
   // await supabase.from('vanguard_knowledge').insert(...)
   ```

---

## 8. Czego NIE robić

- ❌ Dodawać nowych AI capabilities bez przejścia przez feature gate (`docs/PRODUCT_PRINCIPLES.md`).
- ❌ Dawać LLM bezpośredniego zapisu do `vanguard_stream` / `friction_events` bez potwierdzenia człowieka (human gate).
- ❌ Hardkodować `user_id` (zawsze używaj env var `VANGUARD_USER_ID` lub dynamicznego pobierania).
- ❌ Zostawiać API keys, JWT tokenów i service role keys w kodzie.

---

## 9. Rytuał sesji backendowej (agent wchodzi do środowiska)

1. Przeczytaj: `AGENTS.md` → ten plik → `supabase/functions/README.md` → `lessons.md`.
2. Przed pisaniem: **grep czy to już istnieje** (kernel, `_shared/`, `packages/domain`, tabele przez `list_tables`). Duplikaty powstają z lenistwa w tym kroku.
3. Pisz wg sekcji 1-4. Wątpliwość = wybierz wariant, który zmniejsza licznik ratcheta, nigdy ten, który go podnosi.
4. Przed końcem: `npm run ratchet:backend` + `npm run typecheck` + (po deployu) `npm run smoke` + `SELECT count(*)` na tabelach docelowych.
5. Zaktualizuj `lessons.md` (jeśli był błąd) i JSDoc + `npm run registry:generate` (jeśli zmieniłeś funkcję).
6. Jeden temat = jeden commit. Working tree czysty przed następnym tematem.
