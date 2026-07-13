# Vanguard OS — Frontend Guide

> Przewodnik deweloperski oraz zasady projektowe (UX/UI) dla katalogu `src/` (React SPA).
>
> **Dlaczego ten plik istnieje:** audyt frontendu znalazł konkurujące systemy fetch/cache, wiele stylów obsługi błędów, 22 ręcznie pisane modale i odwrócone zależności. Ten przewodnik stanowi jedno źródło prawdy (SSOT) regulujące frontend.
>
> Cztery reguły poniżej (sekcja 6) są **wymuszone przez ESLint jako error** i ich złamanie zablokuje commit.

---

## 0. Definicja 10/10 (mierzalna, nie uznaniowa)

Frontend jest 10/10 wizualnie i technicznie, gdy spełnione są następujące kryteria:

| # | Kryterium | Jak to jest mierzone / sprawdzane |
|---|-----------|----------------------------------|
| 1 | Zero ręcznych overlay (`fixed inset-0`) poza `ui/Modal.tsx`/`ui/ConfirmDialog.tsx` | `grep "fixed inset-0" src/components/` |
| 2 | `index.css` ≤ 550 linii | `wc -l src/index.css` (osiągnięte, 419 linii) |
| 3 | Zero hardkodów kolorów w JSX (`bg-[#hex]`, `text-[#hex]`) | Grep po kodzie JSX |
| 4 | Każdy empty state używa `ui/EmptyState` | `grep -r "border-dashed" src/components/` |
| 5 | Każdy spinner używa `ui/Spinner` | `grep -r "animate-spin"` poza `Spinner.tsx` i Lucide |
| 6 | Każde potwierdzenie używa `ui/ConfirmDialog` | `grep "window\.alert\|window\.confirm"` (osiągnięte, 0 wystąpień) |
| 7 | Shared components w `ui/` mają testy | Obecność plików `*.test.tsx` w `src/components/ui/` |
| 8 | Touch targets ≥44px na mobile | Ręczna weryfikacja na urządzeniach |
| 9 | Brak inline animacji w JSX | `grep -r "animation:" src/components/ | grep -v "\.css"` |

---

## 1. Warstwy — co gdzie mieszka

```
packages/domain/   czysta logika (date math, korelacje, fitness) — zero importu z React/Supabase.
                    Współdzielona z Deno (edge functions) i Vite (frontend).
src/lib/            domena + Supabase. Nie importuje z src/components (patrz reguła 6.4).
src/hooks/          stan React nad src/lib (fetch orchestration, side effects, browser APIs).
src/components/     UI. Nie woła supabase.from() bezpośrednio (patrz reguła 6.1).
├── ui/             shared design primitives (przycisk, modal, spinner, badge, tabs, toast)
├── shared/         cross-feature komponenty strukturalne (max 6-8 elementów)
└── <feature>/      moduły domenowe (kod UI i specyficzny CSS)
```

Import w złą stronę (`lib` → `components`, `packages/domain` → cokolwiek z Reacta) to sygnał, że coś jest źle zaklasyfikowane — przenieś plik, nie dodawaj wyjątku.

### 1.1 Mapa domen — co żyje w `src/components/<feature>/`

Płaska lista ~20 katalogów bez nadrzędnego `features/`. To świadomy kompromis (patrz sekcja 9/10 niżej — każdy katalog to już samodzielny moduł), nie bałagan — ale bez czytania nazw plików nie zawsze widać, co gdzie mieszka. Jedno zdanie per katalog:

| Katalog | Domena |
|---|---|
| `ai/` | Asystent „Oracle" — czat AI, karty klaryfikacji, panel wejścia. |
| `biometrics/` | Trening i biometria: dzienny strain, zdrowie mózgu, mapa mięśni, sauna, logger treningów. |
| `calendar/` | Pełny widok kalendarza: siatka, wydarzenia, pogoda, budżet, mini-kalendarz, powtarzalność. |
| `cards/` | Uniwersalny system kart (factory + typy: encje, dane liczbowe, wizualne, tekstowe, czasowe). |
| `core/` | Rdzeń appki: dashboard, autoryzacja, nawigacja, poranny plan, odżywianie, statystyki, error boundary. |
| `correlations/` | Analiza korelacji między nawykami/zdarzeniami (np. sen a inne czynniki), filtry, podsumowanie. |
| `desktop/` | Osobny "pulpit"/kokpit desktopowy: sekcje fitness/zdrowia, hero-banner, shell nawigacyjny. |
| `growth/` | Kokpit rozwoju osobistego: cele, umiejętności (radar/drzewo), projekty, plan tygodniowy, media do nauki. |
| `identity/` | Skarbiec tożsamości (fundament, dane osobiste użytkownika) oraz galeria zdjęć. |
| `insights/` | Dashboard wniosków/wzorców i statystyk zadań generowanych z danych użytkownika. |
| `integrations/` | Widżety integracji zewnętrznych (obecnie Strava). |
| `lifestyle/` | Kierunek życia (sprint/miesiąc/radar), PowerList (5 zwycięstw dnia), skrzynka linków do triażu. |
| `medical/` | Recepty, okulary, badania lab, kalkulator myopii (EndMyopia), dziennik wzroku. |
| `notes/` | Notatnik w stylu Google Keep: notatki, edytor, siatka masonry, szybkie tworzenie. |
| `projects/` | Zarządzanie projektami/celami życiowymi: karty, priorytety, KPI, retrospektywy. |
| `settings/` | Widok ustawień aplikacji. |
| `shared/` | Widgety współdzielone między modułami (oś czasu dnia, arkusz akcji, podsumowanie tygodnia) — max 6-8 elementów (patrz sekcja 1). |
| `todo/` | Zadania: kanban/matryca Eisenhowera/oś czasu, sekcje, przypomnienia, przeglądy tygodniowe. |
| `ui/` | Design primitives: Badge, Card, Modal, Tabs, Skeleton, Spinner. |
| `widgets/` | Generyczne widżety wykresów (BarChart, TrendChart, TimelineWidget) + fabryka. |

**Nie wiesz gdzie dodać nowy plik?** Szukaj domeny po *danych*, nie po warstwie UI — "nowy typ karty z KPI projektu" idzie do `projects/`, nie do `cards/` (chyba że to naprawdę generyczny renderer bez wiedzy o domenie, wzorzec B w sekcji 10).

**Przykład na dziś:** `getSprintInfo()` mieszka w `src/lib/sprintUtils.ts` — czysta logika domenowa. `src/components/desktop/desktopUtils.ts` re-eksportuje ją przez `export { getSprintInfo } from '../../lib/sprintUtils'` — jeśli dotykasz plików które ją importują, importuj bezpośrednio z `lib/sprintUtils`.

---

## 2. Fetch danych — react-query przez `*Api.ts`

**Kanoniczny wzorzec** (przykład: [`lib/todoApi.ts`](../src/lib/todoApi.ts)):

```ts
// lib/fooApi.ts
export const fooKeys = {
  all: ['foo'] as const,
  list: (userId: string) => [...fooKeys.all, 'list', userId] as const,
};

export function useFooList(userId: string) {
  return useQuery({
    queryKey: fooKeys.list(userId),
    queryFn: () => listFoo(userId),   // czysta funkcja z lib/foo.ts, zwraca dane lub throw
    enabled: !!userId,
  });
}
```

Komponent konsumuje `useFooList(userId)` — nie widzi Supabase w ogóle.

**Reguła:** żaden plik w `src/components/**` nie woła `supabase.from(...)` / `supabase.storage.from(...)` bezpośrednio (egzekwowane, sekcja 6.1). Jeśli potrzebujesz nowego zapytania — dodaj funkcję do istniejącego `*Api.ts` albo stwórz nowy, nie pisz zapytania inline w komponencie "bo to tylko jeden fetch".

**Legacy, nie naśladuj:** `src/lib/goalSpine.cache.ts` (`withCache`, TTL 30s, ręczna inwalidacja) — **usunięty**. Cache w goalSpine idzie teraz wyłącznie przez react-query. Nie przywracaj ręcznego cache'owania.

---

## 3. Błędy — dwie ścieżki, nic trzeciego

| Sytuacja | Rób to |
|---|---|
| Zapis/mutacja nie powiodła się (user coś kliknął) | `notify(message, 'error')` z [`lib/notify.ts`](../src/lib/notify.ts) — toast |
| Potwierdzenie destrukcyjnej akcji | `await confirmDialog(message)` z tego samego pliku |
| Ładowanie danych nie powiodło się (cały widok) | banner/`DataStateNotice` sterowany przez `error` z react-query, nie osobny `useState<string|null>` |
| Błąd bez wpływu na UX (best-effort, np. localStorage quota) | `console.warn`, bez `notify` |

**Zakazane:** `window.alert()` (egzekwowane, sekcja 6.2), goły `console.error` dla błędu, który user powinien zobaczyć, oraz `try { await supabase.from(...).insert(...) } catch` bez sprawdzenia `{ error }` — Supabase JS **nie rzuca** na błędach Postgres/RLS, zwraca `{ error }` w resolved value (patrz `lessons.md`, wpis 2026-06-20). Użyj `unwrap()`/`unwrapList()` z [`lib/supabaseUtils.ts`](../src/lib/supabaseUtils.ts) dla zapytań z `.select()`; dla zapisów bez `.select()` sprawdź `{ error }` ręcznie.

---

## 4. Modale i potwierdzenia

`ui/Modal.tsx` jest jedynym wspólnym overlayem. **Używaj go — nie pisz własnego `fixed inset-0`.**

- Do potwierdzeń (usuń/anuluj) — zawsze `confirmDialog()` z `lib/notify`, nigdy własny state+JSX confirm modal.
- Do treściowych modali — używaj `ui/Modal.tsx` z propsami `isOpen`, `onClose`, `title`, `size`. Jeśli potrzebujesz bottom sheet na mobile — dodaj prop do `ui/Modal`, nie rób nowego overlaya.

---

## 5. Daty — zawsze `lib/date.ts`

`lib/date.ts` re-eksportuje `packages/domain` (`getTodayWarsaw`, `formatWarsawDate`, `combineDateTimeWarsawISO`, `warsawDayBoundsISO`, ...). To jedyne źródło prawdy o "dziś"/strefie czasowej w całym repo (backend i frontend).

**Zakazane** (egzekwowane, sekcja 6.3): inline `new Date().toLocaleDateString('pl-PL', ...)` w komponentach/hookach. Jeśli potrzebujesz etykiety typu "dziś/wczoraj/12 lip" — użyj albo `lib/date.ts`, albo istniejącego modułowego helpera (`calendarHelpers.ts` dla kalendarza, `keepUtils.ts` dla notatek) zamiast pisać formatowanie na miejscu. Jeśli piszesz nowy moduł z własną etykietą dnia — sprawdź najpierw, czy `dayLabel`/`formatWarsawDate` już tego nie robi (audyt znalazł 3 różne implementacje `dayLabel`).

**Absolutny zakaz, niezależnie od reguły lintera:** hardkodowany offset strefy czasowej (`+02:00`/`+01:00`) w budowanym string ISO. To się psuje dwa razy w roku (DST). Zawsze `combineDateTimeWarsawISO(dateStr, timeStr)`.

---

## 6. Reguły wymuszone przez ESLint (`eslint.config.js`)

Cztery bloki pod komentarzem `Frontend boundary rules`, każdy odpowiada sekcji wyżej:

1. **`no-restricted-syntax`** — zakaz `supabase.from()` / `supabase.storage.from()` w `src/components/**`.
2. **`no-restricted-globals`** — zakaz `alert()` w `src/components/**`.
3. **`no-restricted-syntax`** — zakaz `toLocaleDateString('pl-PL', ...)` w `src/components/**` i `src/hooks/**` (poza kanonicznymi wrapperami: `calendarHelpers.ts`, `keepUtils.ts`).
4. **`no-restricted-imports`** — zakaz importu z `**/components/**` wewnątrz `src/lib/**`.

Każda reguła ma własną, nazwaną listę wyjątków (`NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS` itd.) — **osobną od `LEGACY_FILES`**. To rozróżnienie jest celowe: `LEGACY_FILES` zdejmuje `max-lines`/`no-explicit-any`/`no-unused-vars`; te nowe listy zdejmują dokładnie jedną regułę. Plik może być jednocześnie "legacy" dla jednej i "czysty" dla drugiej.

**Gdy dotykasz pliku z którejś listy wyjątków:** napraw i usuń go z listy w tym samym commicie, jeśli to rozsądny zakres zmiany. Nie dodawaj nowych plików do żadnej z tych list — `scripts/ops/check-frontend-ratchets.mjs` (uruchamiane w CI) failuje, jeśli którakolwiek lista urośnie względem `scripts/ops/ratchet-baseline.json`. Jeśli naprawdę musisz dodać wyjątek, zmniejsz baseline świadomie w tym samym commicie i napisz dlaczego.

**Ratchet wzorców (Pattern Counters):** Dodatkowo skrypt `check-frontend-ratchets.mjs` skanuje statycznie kod i kontroluje liczbę wystąpień niepożądanych wzorców (np. ciche błędy `[Background Error]`, wywołania edge functions `/functions/v1/` poza `supabase.ts`, castowanie `as any`, manualne modyfikacje czasu `setUTCDate` itp.). Wartości progowe (`patternCount_*`) w `scripts/ops/ratchet-baseline.json` mogą wyłącznie maleć (ratchet liczy też wzorce, patrz tabela w skrypcie).

**Pułapka przy edycji tych reguł:** ESLint flat config **nie scala** dwóch bloków konfiguracji ustawiających tę samą nazwę reguły dla tego samego pliku — wygrywa ostatni pasujący blok, cicho nadpisując poprzedni. Dlatego `supabase.from` + `storage.from` + `toLocaleDateString` (wszystkie trzy to `no-restricted-syntax`) żyją w **jednym** bloku z jedną tablicą selektorów. Jeśli dodajesz piątą regułę opartą o `no-restricted-syntax`, dopisz selektor do tego samego bloku — nie twórz nowego.

---

## 7. Wywołania edge functions

Kanoniczny helper: `invokeEdge()` z `lib/supabase.ts`. Używa `supabase.functions.invoke()` — auth header i JSON automatycznie.

```ts
import { invokeEdge } from '../lib/supabase';

const data = await invokeEdge<MyType>('function-name', {
  body: { userId, ... },
  signal: AbortSignal.timeout(TIMEOUTS.heavy),
});
```

**Zakaz:** ręczny `fetch(VITE_SUPABASE_URL + '/functions/v1/...')` z kopiowanym nagłówkiem auth. Używaj `invokeEdge` w nowym kodzie. Istniejące raw fetch-e są migrowane stopniowo (niektóre wymagają GET z query stringiem — te zostają).

---

## 8. Decyzje (żeby nie zgadywać)

- **react-query jest kanoniczne** dla server state. `goalSpine.cache.ts` to legacy do stopniowej migracji, nie wzorzec do naśladowania w nowym kodzie (sekcja 2).
- **Zustand (`store/useStore.ts`)** trzyma tylko `session`/`userSettings`/`isSyncing` — nie dokładaj tam per-feature state. Jeśli walczysz z prop-drillingiem `session` przez 4+ komponenty, to sygnał do przeniesienia read-only kontekstu (np. `userId`) do contextu/store, nie do dodania kolejnego propa.
- **Warstwa layoutu vs logiki przy rozbijaniu dużych plików** (patrz `lessons.md`, wpis 2026-06-20 "Monolith refactoring"): zostaw kontener stylizujący (flex/grid wrapper) w pliku nadrzędnym, wydziel czyste widgety zasilane przez propsy — nie odwrotnie.

---

## 9. Organizacja kodu — Folder jako moduł (Folder-as-a-Module)

Gdy limit linii (`max-lines: 300`) lub ratchet linii plików legacy zmusi Cię do wydzielenia kodu, zastosuj sztywną strukturę modułu w osobnym folderze. Nie twórz płaskiej struktury w `components/`.

**Szablon folderu modułu (przykład `components/todo/`):**
```
components/todo/
├── index.ts                # Tylko publiczny eksport (czysta fasada modułu)
├── TodoContainer.tsx       # Kontener: pobiera dane z react-query (DAL), przekazuje propsami
├── TodoView.tsx            # Czysty widok: tylko layout, styl i rendery (Prezenter)
├── hooks/                  # Dedykowane hooki interakcji
│   ├── useTodoDragDrop.ts
│   └── useTodoKeyboard.ts
└── subcomponents/          # Mniejsze wydzielone klocki UI
    ├── TodoCard.tsx
    └── SectionAddForm.tsx
```

**Reguła kciuka:** Plik z logiką danych (`useQuery`/`*Api`) lub plik z JSX — nie oba naraz w jednym 300-liniowym pliku. Podział na Kontener (Container) i Widok (Presenter) ułatwia testowanie i drastycznie zmniejsza liczbę linii.

**Uwaga o pre-commit:** Pre-commit hook uruchamia lintera (`eslint --fix`) oraz ratchety. Kompilacja TypeScript (`tsc --noEmit`) jest powolna i nie uruchamia się przy każdym commicie lokalnie — pełny typecheck leci w CI, dlatego przed puszczeniem zmian upewnij się, że nie popsułeś typów cross-file.

---

## 10. Wzorcowa struktura modułu — Wzorzec A (Feature Module)

Dla modułów z danymi i stanem (`todo/`, `calendar/`, `core/nutrition/`, `notes/`, `desktop/`, `growth/`, `lifestyle/`, `projects/`, `medical/`, `biometrics/`):

```
components/<feature>/
├── index.ts                  # fasada — jedyne, co świat zewnętrzny importuje
├── <Feature>Container.tsx    # DANE: useQuery/*Api, stan, efekty. Zero JSX poza <View {...props}/>
├── <Feature>View.tsx         # WIDOK: czysty prezenter — layout, JSX, style. Zero fetch/mutacji
├── hooks/                    # logika interakcji specyficzna dla modułu
├── subcomponents/            # klocki UI używane tylko wewnątrz modułu
└── <feature>Utils.ts         # czyste funkcje pomocnicze specyficzne dla modułu
```

**Próg zastosowania:** plik >300 linii (limit lintera) LUB miesza dwie odpowiedzialności (fetch+JSX) niezależnie od rozmiaru. **Reguła rozstrzygająca podział:** plik z logiką danych (`useQuery`/`*Api`) albo plik z JSX — nigdy oba naraz w jednym pliku.

Wzorcowy przykład: `components/todo/` — Container/View rozdzielone, `hooks/` z wąsko wyspecjalizowanymi hookami, `weekly/` jako zagnieżdżony pod-moduł (wzorzec jest rekurencyjny).

### Wzorzec B — Type Registry

Dla modułów renderujących "jedna rzecz, wiele wariantów" bez własnego stanu (`cards/`, `widgets/`): `Factory.tsx` (typ → komponent) + podfoldery wg taksonomii domenowej (`entities/`, `temporal/`, `textual/`...), nie wg warstwy technicznej.

**Rozróżnienie A vs B:** jeden ekran/funkcja z jednym stanem → A. "Renderuj X zależnie od typu Y" bez własnego stanu → B.

## 11. Próg dla `lib/` i własność dla `hooks/`

**Reguła progu dla `lib/`:** grupa tematyczna plików płasko jest OK poniżej **6-8 plików** (nazwa pliku wystarcza za nawigację). Powyżej progu — dostaje podfolder (np. `lib/goal/`, `lib/growth/`, `lib/health/`). `*Api.ts` (warstwa dostępu do danych) NIE dostaje własnego katalogu technicznego (`lib/api/`) — zostaje przy swojej domenie, bo grupujemy wg domeny (feature), nie wg roli technicznej — spójnie z Wzorcem A.

**Reguła własności dla `hooks/`:** nie "ile plików", tylko *czy hook ma jednego właściciela-feature, czy jest naprawdę cross-cutting?* Hook z jednym konsumentem-modułem → `<feature>/hooks/`. Prawdziwie globalne (używane przez niepowiązane moduły, brak jednego właściciela) → zostają w `src/hooks/`. Integration-layer sync hooks (Oura/Strava/Calendar) też zostają globalnie, ale oznacz komentarzem w pliku "integration layer, brak jednego feature-właściciela", żeby przyszły agent nie próbował ich przenieść do jednego konsumenta.

## 12. Warstwa stylów — co robi co

| Warstwa | Odpowiada za | Przykład |
|---|---|---|
| `tailwind.config.js` | statyczne, znane-przy-buildzie kolory marki/motywu | `bg-primary` |
| `index.css` (CSS custom properties) | dynamiczne/wybieralne w runtime wartości (Tailwind nie generuje klas ze stringów budowanych w runtime) + globalne tokeny | `var(--keep-bg-red)` |
| Tailwind utility classes w JSX | layout, spacing, typografia — 95% stylowania | `flex items-center gap-2 rounded-xl` |

`index.css` jest **tylko** warstwą design tokenów i cross-cutting animacji (limit ~550 linii, patrz `DESIGN_SYSTEM.md`). CSS specyficzny dla jednego modułu (np. Keep/Notes) żyje w `components/<feature>/<feature>.css`, importowany w pliku wejściowym modułu — Vite wspiera to natywnie, zero konfiguracji.

## 13. Higiena przy refaktorach strukturalnych (rozbijanie god-files, przenosiny)

Zasady wypracowane na realnych regresjach podczas sesji porządkowania `lib/`/`hooks/`/`desktop/` i rozbijania plików >300 linii — nie pomijaj żadnej, nawet dla mechanicznego jednolinijkowego wydzielenia:

1. **Audyt obsługi błędów przed edycją:** `grep -c "notify(\|console\.warn(\|console\.error(" plik` — zapisz liczbę. Po rozbiciu suma tych wywołań we WSZYSTKICH nowych plikach musi być **równa albo większa**, nigdy mniejsza. Realny incydent: rozbicie modala zgubiło `notify()` w catch-u ładowania danych — nie złapał tego ani typecheck, ani lint, ani pełna suite testów.
2. **Po `git mv`/przeniesieniu pliku sprawdź `eslint.config.js` (`LEGACY_FILES`, `NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS`) i `scripts/ops/legacy-lines-baseline.json`** — te listy trzymają ścieżki jako stringi, nie śledzą `git mv`. Stara ścieżka po przenosinach = plik cicho traci wyjątek i lint/ratchet staje się czerwony bez związku z Twoją zmianą.
3. **Nigdy nie dopisuj nowego pliku do `LEGACY_FILES`** żeby ominąć limit — ta lista ma tylko maleć (ratchet to sprawdza: `LEGACY_FILES: N / baseline M`). Plik z błędem lintera — napraw go (właściwy typ, split funkcji), nie chowaj za wyjątkiem.
4. **Weryfikacja w tej kolejności, napraw przed kolejnym plikiem:** `npm run typecheck:ui` → `npx eslint <dotknięte>` → `npm run test` → `npm run ratchet:frontend`. Nie kumuluj długu do końca sesji.
5. **Przy podziale hooka na kilka plików:** sprawdź, że żaden `useState`/`useEffect` nie został przypadkiem zduplikowany między starym a nowym miejscem (klasyczny błąd copy-paste zamiast move — dwa źródła prawdy dla tego samego stanu).
6. **Jedna sesja = jeden commit.** Batch mechanicznych zmian (np. 3 pliki tego samego typu wydzielenia) — nadal jeden commit, ale ogranicz batch tak, żeby cofnięcie było tanie jeśli coś się posypie.
7. **Klasyfikacja ryzyka przed rozbiciem** (przydatne przy każdym pliku >300 linii, nie tylko przy dużej sesji porządkowej): 300-400 linii + ≤4 `useState` + zero gestów/DOM-manipulacji (`onTouch`/`onDrag`/`execCommand`/`getSelection`) → mechaniczne, jedno wydzielenie zwykle wystarcza. 400-600 linii → prawdziwy split (Container/View albo dwa hooki), bez planu-do-akceptacji ale pełna weryfikacja. 600+ linii LUB jakiekolwiek trafienie na gesty/DOM-manipulację niezależnie od rozmiaru → wymaga planu tekstowego zaakceptowanego przed edycją + weryfikacji wizualnej w przeglądarce po. Niepewny przypadek — zaokrąglaj w górę (więcej ostrożności).
8. **Pliki z gęsto powiązaną logiką kursora/selekcji/DOM** (np. rich text editor operujący bezpośrednio na `Range`/`document.execCommand`) są kandydatem do **świadomego wyjątku od limitu linii**, nie mechanicznego rozbicia — rozbicie takiego pliku grozi subtelnymi bugami (np. "skaczący kursor" w rzadkich sekwencjach klawiszy), notorycznie trudnymi do złapania testem. Udokumentuj wyjątek w komentarzu w pliku i w `eslint.config.js`.

---

*Powiązane: [`DEV_GUIDE.md`](DEV_GUIDE.md) (backend), [`README.md`](README.md) (kolejność czytania), [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) (wygląd/UI), `../BACKLOG.md` część IV (otwarta praca strukturalna: god-files, `as any`, itd.), `lessons.md` (incydenty, z których część reguł w sekcji 6/13 wynika wprost).*

*Ostatnia weryfikacja z kodem: 2026-07-11*
