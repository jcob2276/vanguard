# Brief dla MIMO — Design 10/10, sesje DS1-DS6

Kontekst: `docs/DESIGN_SYSTEM_10_10.md` to konstytucja. DS0 (3 komponenty: `ui/Spinner.tsx`,
`ui/EmptyState.tsx`, `ui/ConfirmDialog.tsx`, wszystkie z testami) już zrobione i zacommitowane
(`97fd837e`). Poniżej kolejne sesje, w kolejności z planu.

## Twarde zasady (złamane dzisiaj w S12/S13, nie powtarzać)

1. **Po przeniesieniu/przemianowaniu pliku sprawdź `eslint.config.js` (`LEGACY_FILES`,
   `NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS`) i `scripts/ops/legacy-lines-baseline.json`** —
   te listy trzymają ścieżki jako stringi, nie śledzą git mv. Stara ścieżka = plik traci
   wyjątek i lint/ratchet nagle czerwony bez powodu związanego z twoją zmianą.
2. **Nie dopisuj nowych plików do `LEGACY_FILES`** — ta lista ma tylko maleć (sam ratchet
   to sprawdza: `LEGACY_FILES: N / baseline M`). Jeśli plik ma błąd lint, napraw go
   (właściwy typ, split funkcji), nie chowaj za wyjątkiem.
3. **Po każdym kroku uruchom w tej kolejności:** `npm run typecheck:ui` →
   `npx eslint <dotknięte pliki>` → `npm run test` → `npm run ratchet:frontend`.
   Jeśli coś czerwone — napraw przed przejściem dalej, nie kumuluj długu na koniec sesji.
4. **Jedna sesja (DS1, DS2, ...) = jeden commit**, dopiero po zielonym pełnym zestawie
   (`npm run lint && npm run test && npm run ratchet:frontend && npm run typecheck:ui`).
5. Przy migracji na `ui/Modal` / `ui/EmptyState` / `ui/Spinner` — **czytaj oryginalny plik
   przed podmianą**, nie zgaduj propsów z nazwy. Niektóre "empty state" to drag-target
   zone (`todo/EmptyState.tsx` ma `isDragOver`/`dragColor` — to inny komponent niż
   `ui/EmptyState.tsx`, zostaw go osobno, nie scalaj na siłę).

---

## DS1 — Zastąpić inline patterns (~3-4h, mechaniczne)

Aktualne listy (dziś, po DS0 — większe niż liczby w planie, bo plan pisany wcześniej):

```bash
# empty states (border-dashed) — 28 plików, w tym ui/EmptyState.tsx samo i todo/EmptyState.tsx (ten drugi zostaje, to inny komponent)
grep -rl "border-dashed" src/components

# spinnery (animate-spin) — 35 plików poza ui/Spinner.tsx
grep -rl "animate-spin" src/components | grep -v "ui/Spinner.tsx"

# modale (fixed inset-0) — 19 plików poza ui/Modal.tsx i ui/ConfirmDialog.tsx
grep -rl "fixed inset-0" src/components | grep -v "ui/Modal.tsx\|ui/ConfirmDialog.tsx"

# window.alert/confirm — już 0, nic do zrobienia
grep -rln "window\.alert\|window\.confirm" src
```

Kroki:
- [ ] Podmień `animate-spin ... rounded-full ...` na `<Spinner size="sm|md|lg" />` (dobierz
      rozmiar wg obecnego `h-N w-N`)
- [ ] Podmień inline `border-dashed + emoji + tekst` na `<EmptyState icon label action?/>`
      — **z wyjątkiem** `todo/EmptyState.tsx` (drag-target, zostaje osobno) i samego
      `ui/EmptyState.tsx`
- [ ] Podmień ręczny `fixed inset-0 ... bg-black/N` overlay na `<Modal isOpen onClose title?>`
      — przeczytaj `src/components/ui/Modal.tsx` (props: `isOpen`, `onClose`, `title`,
      `subtitle`, `size`, `showCloseButton`, `closeOnBackdropClick`) przed migracją każdego
      pliku, dopasuj zachowanie 1:1 (czy ma nagłówek, czy zamyka się na backdrop click itd.)
- [ ] Ratchet ma liczniki `patternCount_fixedInset` i baseline w `scripts/ops/
      ratchet-baseline.json` — po migracji **obniż baseline** w tym samym commicie
      (nie zostawiaj starej wyższej liczby)

**DoD:** `grep "fixed inset-0" src/components` → tylko `ui/Modal.tsx` + `ui/ConfirmDialog.tsx`,
`grep "window.alert\|window.confirm" src` → 0, `grep "animate-spin" src/components` → tylko
`ui/Spinner.tsx`. `npm run ratchet:frontend` zielony z obniżonymi baseline'ami.

---

## DS2 — CSS cleanup (~1h, mniejsze niż plan zakładał)

Duża część już zrobiona w S8b frontendowego planu: `notes.css`, `todo.css`,
`muscleHeatmap.css` już wydzielone, `index.css` już na **419 linii** (cel <550 — **już
osiągnięty**). Zweryfikuj tylko:

- [ ] `wc -l src/index.css` — potwierdź <550 (dziś: 419, powinno zostać ok)
- [ ] `grep -c "keep-" src/index.css` — potwierdź 0
- [ ] Jeśli podczas DS1 dopisałeś nowy CSS (np. dla Modal/EmptyState/Spinner) — sprawdź czy
      nie urósł z powrotem ponad 550

**DoD:** zero regresji, `index.css` <550 linii. Jeśli już spełnione, ta sesja to tylko
weryfikacja + krótki commit potwierdzający stan (albo pomiń commit jeśli nic się nie zmieniło).

---

## DS3 — Dark mode audit (~1-2h)

```bash
grep -rn "bg-\[#" src/components
grep -rn "dark:bg-\[#" src
grep -rn "text-\[#" src/components
```

- [ ] Każdy hit zamień na istniejący token (`bg-surface`, `bg-surface-solid`,
      `bg-background`, `text-text-primary` itd. — pełna lista w
      `docs/DESIGN_SYSTEM_10_10.md` sekcja "Istniejące tokeny")
- [ ] Jeśli potrzebny NOWY kolor bez odpowiednika — dodaj wg przepisu w tym samym pliku
      ("Nowy kolor": `:root` + `.dark` + `@theme` w `index.css`, dopiero potem klasa
      Tailwind), nie hardkoduj
- [ ] Ręcznie sprawdź w przeglądarce (`npm run dev`, przełącznik light/dark) minimum:
      Dashboard, Desktop, Todo, Calendar, Keep — te miejsca gdzie dziś były hardkody

**DoD:** wszystkie trzy grepy → 0 wyników.

---

## DS4 — Responsive audit (~2h)

- [ ] Przegląd każdego głównego widoku na 375px / 768px / 1280px (użyj przeglądarki,
      `resize_window` jeśli pracujesz przez Claude Code, albo DevTools ręcznie)
- [ ] Szukaj clickable <44px (przyciski, ikony bez paddingu) — powiększ padding/hit-area
- [ ] Modale na mobile powinny być bottom sheet (`items-end`), na desktop wycentrowane
      (`sm:items-center`) — sprawdź czy `ui/Modal.tsx` już to robi poprawnie po DS1,
      jeśli nie — dopisz responsywność do samego `Modal.tsx` (jedno miejsce, korzyść
      dla wszystkich migrowanych w DS1)
- [ ] Sidebary (np. Keep, Todo desktop) — na mobile `hidden md:flex` lub bottom nav,
      zweryfikuj że nic nie ucieka poza viewport (overflow-x)

**DoD:** zero elementów <44px na mobile w głównych widokach, zero poziomego scrolla.

---

## DS5 — P1 components (~2h)

- [ ] `ui/Skeleton.tsx` — `lines?: number`, `variant?: 'text' | 'card' | 'avatar'`
- [ ] `ui/Badge.tsx` — `count?: number`, `variant?: 'count' | 'dot' | 'tag'`, `color?: string`
- [ ] `ui/Tabs.tsx` — `tabs: {key, label}[]`, `active`, `onChange`
- [ ] Test dla każdego — wzorzec z DS0: `// @vitest-environment happy-dom` na górze pliku,
      `import { render, screen, fireEvent } from '@testing-library/react'`,
      `import { describe, expect, it } from 'vitest'`. Setup jest-dom już globalny
      (`src/test/setupTests.ts` w `vitest.config.ts` → `setupFiles`), nie importuj
      `@testing-library/jest-dom` ręcznie w każdym teście.

**DoD:** 3 komponenty + testy, `npm run test` zielony.

---

## DS6 — Adopcja ciągła (bez końca, zasada skauta)

Nie osobna sesja z commitem — zasada na przyszłość: dotykasz pliku z inline overlay/empty
state/hardkodem koloru → przy okazji przepnij na wspólny komponent/token. Liczniki z DS1/DS3
w ratchecie pilnują że to się nie cofnie.

---

## Kolejność i kiedy zgłosić do review

Rób **DS1 → DS2 → DS3 → DS4 → DS5** po kolei, jeden commit na sesję, pełny zielony zestaw
(`typecheck:ui`, `lint`, `test`, `ratchet:frontend`) przed każdym commitem. Po każdym commicie
zgłoś — ja robię tę samą weryfikację niezależnie (jak przy S11-S14) zanim przejdziesz do
następnej sesji.
