# Vanguard OS

> Prywatny, jednoosobowy system operacyjny do planowania, rejestrowania zachowania i
> długoterminowej samoobserwacji.

Vanguard łączy w jednym miejscu plan dnia, zadania, projekty, notatki, kalendarz,
trening, żywienie, biometrię i codzienną refleksję. Jego głównym zadaniem nie jest
„motywowanie” ani diagnozowanie użytkownika, lecz zachowanie ciągłości: co zostało
zaplanowane, co naprawdę się wydarzyło i jakie powtarzalności są widoczne w danych.

To aktywnie rozwijany system single-user, używany jako:

- responsywna aplikacja React instalowalna jako PWA;
- aplikacja Android oparta na Capacitorze;
- bot Telegram do szybkiego zapisu tekstu i głosu oraz pracy z Oracle;
- backend Supabase z bazą PostgreSQL, Auth, RLS, cronami i Edge Functions;
- warstwa pamięci behawioralnej, która oddziela dowody od interpretacji.

## Najważniejsza zasada

**System mierzy zachowanie. Użytkownik nadaje mu znaczenie.**

Vanguard rozdziela cztery pojęcia:

1. **Plan** — co powinno się wydarzyć.
2. **Ruch** — konkretna czynność możliwa do rozpoczęcia i zakończenia.
3. **Dowód** — zapis tego, co faktycznie się wydarzyło.
4. **Refleksja** — znaczenie nadane temu przez użytkownika po fakcie.

LLM jest warstwą rozumowania, nie źródłem prawdy. Wnioski nie mogą po cichu mutować
warstwy dowodów, a wzorzec wymaga powtarzalnych obserwacji, jawnej liczebności próby
i możliwości korekty przez użytkownika.

Pełne guardraile opisuje
[`docs/PRODUCT_PRINCIPLES.md`](./docs/PRODUCT_PRINCIPLES.md), a kanoniczny język
produktu — [`docs/PRODUCT_LANGUAGE.md`](./docs/PRODUCT_LANGUAGE.md).

## Co działa obecnie

### Codzienne wykonanie

- **Dziś** — plan dnia, szybkie przechwytywanie, żywienie, trening, sauna, nawyki
  i bieżące sygnały.
- **Tydzień** — przegląd kierunku, tygodniowy plan, KPI, sprinty i propozycje
  wymagające decyzji.
- **Projekty i Zadania** — natywne projekty, sekcje zadań, priorytety i kamienie
  milowe.
- **Historia** — historia treningów, ciała, jedzenia, zdjęć i wniosków.
- **Kalendarz i Terminy** — kalendarz Google oraz obowiązki życiowe, np. dokumenty,
  przeglądy i urodziny.
- **Notatki i Linki** — edytor notatek, archiwum oraz inbox treści udostępnianych
  z przeglądarki lub Androida.

### Powierzchnie aplikacji

<!-- README_SYNC_ROUTES_START -->

| Trasa | Powierzchnia |
|---|---|
| `/` | alias strony Dziś |
| `/dzis` | plan i wykonanie bieżącego dnia |
| `/tydzien` | plan, przegląd i kierunek tygodnia |
| `/projekty` | projekty, KPI i kamienie milowe |
| `/historia` | historia zdrowia, aktywności i żywienia |
| `/keep` | Notatki |
| `/todo` | Zadania |
| `/kalendarz` | kalendarz i bloki czasu |
| `/terminy` | obowiązki życiowe z wyprzedzeniem przypomnień |
| `/links` | inbox zapisanych linków |
| `/fundament` | fundament i kontekst tożsamości |
| `/trening`, `/sauna` | dedykowane rejestratory aktywności |
| `/dashboard` | rozbudowany kokpit desktopowy |
| `/finanse` | FIRE, runway, portfel i przepływy |
| `/rozwoj` | umiejętności, eksperymenty i rozwój |
| `/badania` | wyniki badań i trendy medyczne |
| `/korelacje` | zależności między zachowaniem a wynikami |
| `/korealcje` | historyczna literówka przekierowywana do `/korelacje` |
| `/optics` | narzędzia związane ze wzrokiem |
| `/settings` | konto, integracje, powiadomienia i konfiguracja |
| `/dev/design-system` | deweloperski podgląd design systemu, dostępny bez sesji tylko w trybie DEV |

<!-- README_SYNC_ROUTES_END -->

Wszystkie trasy poza deweloperskim podglądem design systemu wymagają aktywnej sesji
Supabase Auth.

### Zdrowie i aktywność

- synchronizacja danych Oura i Strava;
- własne logowanie treningów siłowych, sauny, posiłków, kofeiny i suplementów;
- dzienne agregaty snu, gotowości, obciążenia i regeneracji;
- historia pomiarów ciała i wyników badań;
- analiza obciążenia treningowego, jakości jedzenia i efektów zachowań;
- przypomnienia przez Web Push oraz FCM w aplikacji Android.

### Pamięć i AI

- Telegram przyjmuje tekst, głos, posiłki, treningi, korekty i pytania;
- Oracle odpowiada na podstawie bieżącego strumienia, biometrii oraz skompilowanej
  pamięci;
- klasyfikator wyprowadza z surowego strumienia zdarzenia tarcia i odzyskiwania;
- graf encji i kompilowana wiki kondensują pamięć bez zastępowania danych źródłowych;
- nocne procesy budują agregaty, wykrywają powtarzalności i wystawiają propozycje
  do oceny przez użytkownika;
- serwer MCP udostępnia wybrane dane i narzędzia autoryzowanym agentom.

Dokładny status aktywnych, wyłączonych i usuniętych funkcji znajduje się w
[`docs/FEATURE_LIFECYCLE.md`](./docs/FEATURE_LIFECYCLE.md). To ważne, ponieważ repo
zawiera migracje i ślady starszych iteracji, których nie należy traktować jako
aktywnego produktu.

## Codzienna pętla

```text
cały dzień                 południe                     wieczór
──────────                 ─────────                    ───────
aplikacja / Telegram  →    „Wywiad” na Telegramie  →    refleksja z ostatnich 24 h
plan, ruchy, dowody         jedno pytanie łączące        użytkownik nadaje znaczenie
                           wątki i luki w pamięci
```

Autonomiczny briefing poranny oraz dawny check w środku dnia zostały usunięte.
Planowanie jutra odbywa się w aplikacji lub w sesji Oracle. Wieczorny Telegram służy
refleksji, nie automatycznemu układaniu planu.

## Architektura

```text
┌─────────────────────────────────────────────────────────────────┐
│ Wejścia                                                         │
│ React PWA / Android · Telegram · Oura · Strava · Google Calendar │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase                                                        │
│ PostgreSQL + RLS · Auth · Edge Functions · pg_cron · Storage     │
├─────────────────────────────────────────────────────────────────┤
│ evidence          pamięć pochodna          reasoning             │
│ stream, plany,    graf encji, wiki,        Oracle, analizy,      │
│ logi, biometria   agregaty i wzorce        propozycje            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Konsumenci                                                      │
│ widoki aplikacji · Telegram · powiadomienia · MCP · audyt        │
└─────────────────────────────────────────────────────────────────┘
```

### Kanoniczna ścieżka dowodów

<!-- README_SYNC_FUNCTIONS_START -->

```text
Telegram / głos / ręczny zapis
              │
              ▼
       vanguard_stream
              │
              ├──▶ vanguard-auto-classify ──▶ friction_events
              │         jedyna ścieżka klasyfikacji tarcia
              │
              ├──▶ vanguard-architect ──────▶ graf encji i relacji
              │
              └──▶ vanguard-wiki-compiler ─▶ skompilowana pamięć
```

Funkcje wykonujące tę ścieżkę to `vanguard-auto-classify`, `vanguard-architect`
i `vanguard-wiki-compiler`.

<!-- README_SYNC_FUNCTIONS_END -->

Oracle, analityk i syntezy czytają przede wszystkim świeży strumień, potwierdzone
zdarzenia oraz pamięć pochodną. Oracle nie zapisuje własnych interpretacji jako
faktów w grafie podczas rozmowy.

### Telegram

Webhook Telegrama jest cienkim wejściem do trwałej kolejki. Osobny worker przetwarza
wiadomości i callbacki, dzięki czemu przyjęcie aktualizacji jest oddzielone od
transkrypcji, klasyfikacji i odpowiedzi modelu. Wiadomości wychodzące korzystają z
analogicznego outboxu.

Aktualne tryby wejścia, przepływy oraz mapę handlerów opisują
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) i
[`supabase/functions/README.md`](./supabase/functions/README.md).

## Stos technologiczny

| Warstwa | Technologie |
|---|---|
| Web | React 19, TypeScript, Vite, React Router, TanStack Query, Zustand |
| UI | Tailwind CSS 4, Framer Motion, Recharts, Lucide |
| PWA | własny service worker, offline queue, Web Push |
| Android | Capacitor 8, natywne integracje lokalizacji, Usage Stats, FCM i background sync |
| Backend | Supabase PostgreSQL, Auth, RLS, Storage, Edge Functions, pg_cron |
| Funkcje | TypeScript uruchamiany w Deno |
| Modele | DeepSeek, OpenAI Whisper, OpenAI embeddings |
| Integracje | Telegram Bot API, Oura, Strava, Google Calendar, ActivityWatch |
| Testy i jakość | Vitest, Testing Library, ESLint, TypeScript, Knip, własne ratchety i smoke testy |
| Hosting | Vercel dla PWA, Supabase dla backendu |

## Struktura repozytorium

```text
Vanguard/
├── src/                       # aplikacja React
│   ├── components/            # moduły i widoki domenowe
│   ├── hooks/                 # orkiestracja stanu i integracji
│   ├── lib/                   # API, logika domenowa i adaptery
│   └── sw.ts                  # service worker PWA
├── packages/domain/           # współdzielona, czysta logika domenowa
├── supabase/
│   ├── functions/             # Edge Functions oraz wspólny kernel
│   ├── migrations/            # niezmienne migracje PostgreSQL
│   └── config.toml            # lokalna i wdrożeniowa konfiguracja funkcji
├── android/                   # natywna powłoka Capacitor
├── scripts/
│   ├── ops/                   # deploy, smoke testy i kontrole CI
│   ├── aw/                    # lokalna integracja ActivityWatch
│   └── analysis/              # ewaluacje i analizy jednorazowe
├── docs/                      # dokumentacja architektury i produktu
├── AGENTS.md                  # konstytucja repozytorium
└── BACKLOG.md                 # jedyny backlog otwartej pracy
```

Pełną mapę frontendu i backendu zawiera
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Generowany rejestr funkcji, ich
triggerów, odczytów, zapisów i konsumentów znajduje się w
[`supabase/functions/FUNCTIONS.md`](./supabase/functions/FUNCTIONS.md). README nie
kopiuje ich liczby ani pełnej listy, ponieważ rejestr jest generowany z kodu.

## Uruchomienie aplikacji webowej

### Wymagania

- Node.js i npm zgodne z wersjami zależności zapisanymi w `package-lock.json`;
- dostęp do skonfigurowanego projektu Supabase;
- Deno do sprawdzania typów Edge Functions;
- opcjonalnie Supabase CLI do pracy z lokalną bazą i funkcjami;
- opcjonalnie Android Studio oraz JDK do budowania aplikacji Android.

### Instalacja

```bash
npm ci
```

Utwórz lokalny plik środowiskowy na podstawie przykładu:

```bash
cp .env.example .env.local
```

W PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Minimalna konfiguracja frontendu:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Następnie uruchom serwer deweloperski:

```bash
npm run dev
```

Vite wypisze lokalny adres aplikacji. Logowanie i dane będą działać dopiero po
podłączeniu projektu Supabase ze zgodnym schematem, RLS i wdrożonymi funkcjami.

### Zmienne środowiskowe

Aktualny szablon znajduje się w [`.env.example`](./.env.example). Poniższe listy są
sprawdzane automatycznie względem odwołań w kodzie.

#### Frontend

<!-- README_SYNC_FRONTEND_ENV_START -->

| Zmienna | Wymagana | Konsument |
|---|---|---|
| `VITE_SUPABASE_URL` | tak | klient Supabase |
| `VITE_SUPABASE_ANON_KEY` | tak | klient Supabase |
| `VITE_GOOGLE_CLIENT_ID` | dla kalendarza | logowanie OAuth Google |
| `VITE_OPENWEATHERMAP_API_KEY` | dla pogody | prognoza w kalendarzu |
| `VITE_VAPID_PUBLIC_KEY` | dla Web Push | rejestracja subskrypcji push |

<!-- README_SYNC_FRONTEND_ENV_END -->

#### Edge Functions

<!-- README_SYNC_BACKEND_ENV_START -->

| Obszar | Zmienne odczytywane przez kod |
|---|---|
| Supabase i zakres użytkownika | `SUPABASE_URL`, `SB_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VANGUARD_USER_ID`, `ALLOWED_ORIGINS` |
| Harmonogramy | `VANGUARD_CRON_SECRET` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_SETUP_SECRET` |
| Modele | `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| MCP | `MCP_SERVER_SECRET` |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Firebase/FCM | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

<!-- README_SYNC_BACKEND_ENV_END -->

Nie wszystkie zmienne są potrzebne do samego uruchomienia interfejsu. `SB_SECRET_KEY`
i `SUPABASE_SERVICE_ROLE_KEY` są obsługiwanymi przez kernel alternatywami klucza
serwisowego. Sekrety backendu ustawia się w środowisku Supabase, nigdy w kodzie ani
w zmiennych `VITE_*`.

## Android

Aplikacja Android korzysta z tego samego `src/` co PWA. Kompilacja w trybie Capacitor
wyłącza service worker i przygotowuje względne ścieżki dla natywnej powłoki.

```bash
npm run mobile:sync
npm run mobile:open
```

Pierwsza komenda buduje frontend i synchronizuje katalog `android/`; druga otwiera
projekt w Android Studio. FCM wymaga lokalnej konfiguracji Firebase, a natywne
telemetrie wymagają odpowiednich uprawnień systemowych. Bieżący stan tej warstwy jest
opisany w [`docs/agent/ACTIVE_WORK.md`](./docs/agent/ACTIVE_WORK.md).

## Kontrole jakości

Najczęściej używany lokalny zestaw:

```bash
npm run typecheck:ui
npm run typecheck
npm run lint
npm run test
npm run build
npm run ratchet:frontend
npm run ratchet:backend
npm run contracts:check
```

Dodatkowe kontrole:

| Polecenie | Cel |
|---|---|
| `npm run smoke:ui` | szybki test zbudowanego interfejsu |
| `npm run test:edge` | testy współdzielonego kodu Edge w Deno |
| `npm run audit:readme` | zgodność README z trasami, env, skryptami, linkami i funkcjami |
| `npm run audit:registry` | zgodność rejestru funkcji z systemem plików |
| `npm run registry:generate` | ponowne wygenerowanie mapy Edge Functions |
| `npm run db:check-drift` | kontrola rozjazdu migracji |
| `npm run audit:knip` | poszukiwanie martwego kodu i zależności |
| `npm run oss:audit` | kontrola sekretów i prywatnych danych przed publikacją |
| `npm run smoke` | powdrożeniowy smoke test backendu z service role |
| `npm run e2e:loop` | test pełnej dziennej pętli |

`npm run typecheck` dotyczy funkcji Deno, natomiast `npm run typecheck:ui` sprawdza
aplikację React. Smoke testy backendu wymagają skonfigurowanych sekretów i dostępu do
projektu Supabase.

## Baza danych i Edge Functions

- Każda zmiana schematu przechodzi przez nową migrację w `supabase/migrations/`.
- Nowe tabele od początku wymagają RLS i polityk własności danych.
- Wspólne mechanizmy HTTP, auth, czasu, DB, modeli i Telegrama żyją w
  `supabase/functions/_shared/`; funkcje nie powinny tworzyć równoległych implementacji.
- Rejestr funkcji jest generowany z nagłówków JSDoc w ich plikach wejściowych.
- Funkcje cronowe i webhookowe mają szczególne wymagania `verify_jwt`; źródłem prawdy
  są `supabase/config.toml`, rejestr i manifest smoke testów.
- Po wdrożeniu wymagane są smoke testy i kontrola logów, szczególnie pod kątem 401.

Szczegółowy kontrakt backendu:
[`docs/BACKEND_CONTRACT.md`](./docs/BACKEND_CONTRACT.md). Instrukcje migracji:
[`supabase/migrations/README.md`](./supabase/migrations/README.md). Operacje i deploy:
[`scripts/README.md`](./scripts/README.md) oraz [`docs/runbooks/`](./docs/runbooks/).

## Zasady rozwoju

1. **Rozszerzaj istniejące ścieżki zamiast je duplikować.** Nie powstaje drugi klient
   Telegrama, drugi klasyfikator tarcia ani boczny model zadań.
2. **Warstwa dowodów i warstwa rozumowania pozostają oddzielone.**
3. **Aktualny kontekst ma pierwszeństwo przed archiwum.** Historyczny wpis nie może
   automatycznie opisywać bieżącego stanu.
4. **Wzorzec musi pokazywać źródło, zakres, `n` i niepewność.**
5. **Funkcja jest skończona dopiero wtedy, gdy jej wynik ma konsumenta.**
6. **Frontend nie odpytuje Supabase bezpośrednio z komponentów.** Dostęp do danych
   przechodzi przez warstwę `src/lib/`.
7. **Nie używamy natywnych `window.alert()` ani `window.confirm()`.**
8. **Nowe pliki UI pozostają poniżej limitu 300 linii i mają jedną odpowiedzialność.**
9. **Nie zapisujemy sekretów ani prawdziwych danych użytkownika w repozytorium.**

Przed zmianą kodu przeczytaj [`AGENTS.md`](./AGENTS.md), a następnie dokument domenowy
wskazany przez [`docs/README.md`](./docs/README.md). Zasady współpracy i checklistę PR
zawiera [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Dokumentacja i źródła prawdy

Dokumentacja ma hierarchię. W razie sprzeczności obowiązuje:

1. [`AGENTS.md`](./AGENTS.md) — konstytucja i zasady repozytorium;
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — przepływ danych i mapa systemu;
3. [`supabase/functions/README.md`](./supabase/functions/README.md) oraz generowany
   [`FUNCTIONS.md`](./supabase/functions/FUNCTIONS.md) — rejestr backendu;
4. [`docs/BACKEND_CONTRACT.md`](./docs/BACKEND_CONTRACT.md) — kontrakt Edge Functions;
5. [`docs/FRONTEND_GUIDE.md`](./docs/FRONTEND_GUIDE.md) i
   [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — frontend i UI;
6. [`docs/FEATURE_LIFECYCLE.md`](./docs/FEATURE_LIFECYCLE.md) — status funkcji;
7. [`BACKLOG.md`](./BACKLOG.md) — jedyne miejsce otwartej pracy.

North Star projektu znajduje się w
[`docs/direction/KIERUNEK.md`](./docs/direction/KIERUNEK.md). Jest kierunkiem
długoterminowym, nie deklaracją, że każda opisana tam zdolność już działa.

## Prywatność i bezpieczeństwo

Vanguard przetwarza szczególnie wrażliwe dane: głos, plany, kalendarz, żywienie,
lokalizację, historię aktywności i biometrię. Repozytorium powinno zawierać wyłącznie
kod, schematy i dane syntetyczne.

Nie commituj plików środowiskowych, tokenów, kluczy service role, eksportów ani
rzeczywistych rekordów użytkownika. Problemy bezpieczeństwa należy zgłaszać prywatnie
zgodnie z [`SECURITY.md`](./SECURITY.md).

## Licencja

Kod jest udostępniany na licencji [MIT](./LICENSE). Projekt pozostaje mocno
opiniotwórczym systemem budowanym pod jednego użytkownika; fork wymaga własnego projektu
Supabase, sekretów, polityk RLS i konfiguracji integracji.
