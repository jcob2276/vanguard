# Vanguard OS — Frontend Guide

> Odpowiednik [`DEV_GUIDE.md`](DEV_GUIDE.md) dla `src/` (React SPA). DEV_GUIDE opisuje edge functions/DB — tu jest to samo dla frontendu.
>
> **Dlaczego ten plik istnieje:** audyt frontendu (2026-07-09) znalazł 3 równoległe systemy fetch/cache, 4 style error handlingu, 22 ręcznie pisane modale, 4 systemy formatowania dat i odwróconą zależność `lib → components`. Żadna z tych rzeczy nie wynikała ze złego kodu — wynikała z braku jednego miejsca z odpowiedzią "jak to się robi w tym repo". To jest to miejsce.
>
> Cztery reguły poniżej (sekcja 6) są **wymuszone przez ESLint jako error**, nie tylko opisane — nowy kod, który je łamie, nie przejdzie `npm run lint` / CI. Nie proś, egzekwuj.

---

## 1. Warstwy — co gdzie mieszka

```
packages/domain/   czysta logika (date math, korelacje, fitness) — zero importu z React/Supabase.
                    Współdzielona z Deno (edge functions) i Vite (frontend).
src/lib/            domena + Supabase. Nie importuje z src/components (patrz reguła 6.4).
src/hooks/          stan React nad src/lib (fetch orchestration, side effects, browser APIs).
src/components/     UI. Nie woła supabase.from() bezpośrednio (patrz reguła 6.1).
```

Import w złą stronę (`lib` → `components`, `packages/domain` → cokolwiek z Reacta) to sygnał, że coś jest źle zaklasyfikowane — przenieś plik, nie dodawaj wyjątku.

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

*Powiązane: [`DEV_GUIDE.md`](DEV_GUIDE.md) (backend), [`READING_ORDER.md`](READING_ORDER.md) (gdzie ten plik wpina się w kolejność czytania), `lessons.md` (incydenty, z których część reguł w sekcji 6 wynika wprost).*

*Ostatnia weryfikacja z kodem: 2026-07-10*
