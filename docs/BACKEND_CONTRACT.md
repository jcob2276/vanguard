# BACKEND CONTRACT — twarde zasady dla agentów

> **Egzekwowane mechanicznie przez `npm run ratchet:backend`** (`scripts/ops/check-backend-contract.mjs` + `backend-contract-baseline.json`).
> Reguła bez mechanizmu nie istnieje — jeśli dodajesz regułę do tego pliku, dodaj licznik do skryptu w tym samym commicie.
> Ostatnia weryfikacja z kodem: **2026-07-11**.

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

## 2. Zakazy z licznikami (stan baseline 2026-07-11)

Ratchet pilnuje, żeby liczby **nigdy nie rosły**. Zmniejszyłeś — obniż baseline w tym samym commicie.

| Zakaz | Baseline | Docelowo |
|---|---|---|
| `createClient(` poza kernelem | **0** | 0 (twarde) |
| raw `fetch` do telegram/openai/deepseek poza `_shared` | **7** | 0 |
| inline `toLocaleDateString(` w funkcjach | **17** | 0 |
| `as any` w `supabase/functions/` | **73** | 0 |
| `new Response(JSON.stringify(...))` zamiast helpera | **140** | 0 (po zbudowaniu `jsonResponse`/`serveJson` w kernelu) |
| `SB_SECRET_KEY` poza kernelem | **6** | 0 |
| Pliki > 300 linii | **23 pliki** (zamrożone, tylko maleją) | 0 |

Nazwane wyjątki (jedyne legalne):
- `_shared/vanguardCore.ts` ma prywatną kopię date-helpera (zero-dependency by design, opisane w nagłówku pliku).
- Endpointy setup w `vanguard-telegram/index.ts` (setWebhook/setMyCommands) mogą wołać Telegram API bezpośrednio — to bootstrap, nie runtime.

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

Jeśli widzisz w kodzie `v4-flash` + `json_object` razem — to bug albo ta tabela jest nieaktualna: **zweryfikuj empirycznie i popraw jedno albo drugie w tym samym commicie** (aktualnie: `vanguard-auto-classify` używa tej kombinacji i działa — sprzeczność do rozstrzygnięcia).

---

## 4. Architektura wzorcowa (10/10) — do czego zmierzamy

```
packages/domain/          czysta logika (daty, statystyka, fitness) — zero IO, testowalna w Vitest i Deno
supabase/functions/
  _shared/
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

## 5. Mapa rozbicia molochów (kolejność wg wartości)

Przy DOTKNIĘCIU któregokolwiek z tych plików: wydziel moduł, obniż baseline. Nie dopisuj.

| Plik | Linie | Plan podziału |
|---|---|---|
| `vanguard-wiki-compiler/index.ts` | 776 | `compile/`, `review/`, `prompts.ts`, router |
| `vanguard-oracle/index.ts` | 723 | `handlers/search.ts`, `handlers/goalCreate.ts`, `handlers/taskBreakdown.ts` (funkcje już są — tylko przenieść) |
| `vanguard-telegram/_router/interceptors.ts` | 666 | 4 funkcje po ~150 linii → osobne pliki per interceptor |
| `vanguard-auto-classify/index.ts` | 638 | `prompts.ts` (~250 linii promptów!), `handlers/todoClassify.ts`, `handlers/todoExtract.ts`, `classify.ts` |
| `vanguard-eval-interview/index.ts` | 609 | `questionBuilder.ts`, `curiosity.ts`, router |
| `analyze-training-load/analysis.ts` | 603 | sekcje analizy → moduły per metryka |
| `_shared/nightly/metrics_strain.ts` | 602 | strain vs recovery vs readiness (3 porty NOOP) |
| `recap/weekly-recap.ts` | 552 | `phase1.ts` / `phase2.ts` / formatters |
| pozostałe 15 plików 300-500 | — | przy dotknięciu |

---

## 6. Rytuał sesji backendowej (agent wchodzi do środowiska)

1. Przeczytaj: `AGENTS.md` → ten plik → `supabase/functions/README.md` → `lessons.md`.
2. Przed pisaniem: **grep czy to już istnieje** (kernel, `_shared/`, `packages/domain`, tabele przez `list_tables`). Duplikaty powstają z lenistwa w tym kroku.
3. Pisz wg sekcji 1-4. Wątpliwość = wybierz wariant, który zmniejsza licznik ratcheta, nigdy ten, który go podnosi.
4. Przed końcem: `npm run ratchet:backend` + `npm run typecheck` + (po deployu) `npm run smoke` + `SELECT count(*)` na tabelach docelowych.
5. Zaktualizuj `lessons.md` (jeśli był błąd) i JSDoc + `npm run registry:generate` (jeśli zmieniłeś funkcję).
6. Jeden temat = jeden commit. Working tree czysty przed następnym tematem.
