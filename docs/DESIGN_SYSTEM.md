# Vanguard Design System

> Reguły tworzenia i modyfikacji UI w Vanguard OS.
> Każdy agent (AI lub człowiek) PRZED zmianą UX czyta ten plik.
> Dokument opisuje **mechanizmy** (jak robić), nie **stany** (co dziś wygląda).

---

## Zasada nadrzędna

**Nowy feature = nowy plik CSS + nowy komponent w `ui/`, nigdy inline w istniejącym pliku.**

Bałagan nie powstaje przez jeden zły commit. Powstaje przez 50 "małych wyjątków" które
nikt nie rejestruje. Ten plik jest rejestrem wyjątków i warunków brzegowych.

---

## Struktura plików

```
src/
├── index.css                    ← TYLKO tokeny + animacje cross-cutting (≤550 linii)
├── components/
│   ├── ui/                      ← shared design primitives (KAŻDY nowy tutaj)
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   ├── ToastHost.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Spinner.tsx
│   │   ├── Badge.tsx
│   │   ├── Tabs.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── DetailPageLayout.tsx
│   │   ├── BrandTitle.tsx
│   │   ├── CharacterAvatar.tsx
│   │   └── PersonaAvatarButton.tsx
│   ├── shared/                  ← cross-feature, nie-primitive (6-8 max)
│   └── <feature>/               ← moduły domenowe
│       ├── components/          ← klocki używane TYLKO wewnątrz modułu
│       ├── hooks/
│       └── <feature>.css        ← CSS modułu (jeśli >0 linii Tailwind)
```

---

## Warstwy CSS — co w czym

| Warstwa | Gdzie | Co tam | Limit |
|---|---|---|---|
| **Tokeny** | `index.css :root` + `.dark` | Kolory, cienie, fonty, radiuse — rzeczy które zmieniają się między motywami | ~200 linii |
| **Theme mapping** | `index.css @theme` | Mapowanie tokenów na Tailwind (bg-primary, text-text-primary) | ~25 linii |
| **Animacje** | `index.css` (po @theme) | `@keyframes` + klasy `.animate-*` używane przez ≥2 moduły | ~80 linii |
| **Component classes** | `index.css @layer components` | `.card`, `.btn-primary`, `.input` — generyczne klasy komponentowe | ~150 linii |
| **Moduł CSS** | `src/components/<feature>/<feature>.css` | CSS specyficzny dla jednego modułu (Keep, Todo, itp.) | brak limitu |
| **Inline Tailwind** | JSX | Layout, spacing, typografia — 95% stylowania | — |

### Reguła: index.css ≤ 550 linii

Jeśli `index.css` przekracza 550 linii — finding jest **critical**. Modułowy CSS
wynosi się do `components/<feature>/<feature>.css`. Import w pliku wejściowym modułu.

---

## Shared Components — kto co robi

### Modal.tsx — JEDYNY sposób na overlay

```tsx
import Modal from '../ui/Modal';

<Modal isOpen={open} onClose={close} title="Tytuł" size="md">
  {/* treść */}
</Modal>
```

**Zakaz:** budowanie własnego `fixed inset-0` overlay. Nie ma wyjątków.
Jeśli `ui/Modal` nie obsługuje Twojego case'u (np. bottom sheet na mobile) —
dodaj prop do `ui/Modal`, nie rób nowego overlaya.

**Props available:**
- `isOpen`, `onClose` — required
- `title`, `subtitle` — opcjonalne
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'`
- `showCloseButton` (default: true)
- `closeOnBackdropClick` (default: true)

**Zachowanie:** Escape zamyka, backdrop click zamyka, body scroll lock, `aria-modal="true"`,
focus trap (TODO: dodać).

### EmptyState.tsx — pusty stan

```tsx
import EmptyState from '../ui/EmptyState';

<EmptyState icon="📝" label="Brak notatek" action={{ label: "Dodaj", onClick: create }} />
```

**Zakaz:** inline `border-dashed + emoji + tekst` w komponentach.
Kaźdy pusty stan przechodzi przez `EmptyState`.

### ConfirmDialog.tsx — potwierdzenie akcji

```tsx
import { confirmDialog } from '../ui/ConfirmDialog';

const ok = await confirmDialog("Na pewno usunąć?");
if (ok) { /* delete */ }
```

**Zakaz:** `window.alert()`, `window.confirm()`, własny modal potwierdzeń.
Jeden mechanizm potwierdzeń w całej apce.

### Spinner.tsx — ładowanie

```tsx
import Spinner from '../ui/Spinner';

<Spinner size="md" />  // sm | md | lg
```

**Zakaz:** inline `animate-spin rounded-full h-8 w-8 border-t-2 border-primary`.
Kaźdy loading przechodzi przez `Spinner`.

### Skeleton.tsx — placeholder ładowania

```tsx
import Skeleton from '../ui/Skeleton';

<Skeleton lines={3} />           // tekst
<Skeleton variant="card" />      // karta
<Skeleton variant="avatar" />    // okrągły
```

**Zakaz:** ręczne "border animate-pulse" w komponentach.

---

## Moduły CSS — zasady

### Kiedy tworzyć nowy plik CSS

- Komponent ma **≥5 linii** niemożliwych do zapisania w Tailwind (np. pseudo-elements,
  złożone animacje, `::before`/`::after`, `backdrop-filter` w runtime)
- Komponent ma **≥3 klasy CSS** które się powtarzają między elementami
- Kod CSS w `index.css` należy do jednego modułu (np. Keep) — wynosi się do
  `components/notes/notes.css`

### Kiedy NIE tworzyć nowego pliku CSS

- Wystarczy Tailwind utility classes (≥95% przypadków)
- Styl jest używany przez ≥2 moduły — wtedy do `index.css @layer components`
- To jestokens/global — wtedy do `index.css :root`

### Import kolejność

```tsx
// W pliku wejściowym modułu (np. Keep.tsx lub index.ts)
import '../ui/Modal.css';      // shared (jeśli istnieje)
import './notes.css';          // moduł-specific
```

Vite zachowuje kolejność importów. Jeśli `notes.css` nadpisuje coś z `index.css`,
kolejność importu musi to odzwierciedlać.

---

## Tokeny — jak dodawać

### Nowy kolor

1. Dodaj do `:root` w `index.css`: `--my-new-color: #...;`
2. Dodaj do `.dark` w `index.css`: `--my-new-color: #...;`
3. Dodaj do `@theme` w `index.css`: `--color-my-new: var(--my-new-color);`
4. Używaj jako `bg-my-new`, `text-my-new` w Tailwind

**Zakaz:** hardkodowanie kolorów w JSX (`bg-[#141414]`, `text-[#f8fafc]`).
Każdy kolor idzie przez token.

### Nowy shadow

1. Dodaj do `:root`: `--shadow-my: 0 4px 12px rgba(0,0,0,0.1);`
2. Dodaj do `.dark`: `--shadow-my: 0 4px 12px rgba(0,0,0,0.5);`
3. Dodaj do `@theme`: `--shadow-my: var(--shadow-my);`
4. Używaj jako `shadow-my` w Tailwind

### Nowy radius

1. Dodaj do `:root`: `--radius-my: 12px;`
2. Używaj jako `rounded-[var(--radius-my)]` lub dodaj do Tailwind config

---

## Animacje — zasady

### Dostępne animacje (nie twórzy nowych bez powodu)

| Klasa | Efekt | Kiedy używać |
|---|---|---|
| `animate-fadeIn` | Fade-in-up (0.28s) | Modale, karty wchodzące |
| `animate-ios-modal` | Slide-up z scale (0.38s) | Pełnoekranowe modale mobile |
| `animate-spring-right` | Slide right (0.34s spring) | Tab swipe w prawo |
| `animate-spring-left` | Slide left (0.34s spring) | Tab swipe w lewo |
| `animate-scaleUp` | Scale (0.2s spring) | Modale (w `ui/Modal`) |

### Nowa animacja

1. Nazwa: `animate-<co>` (np. `animate-slideIn`)
2. Definicja: `@keyframes <co>` w `index.css` (po istniejących animacjach)
3. Limit: **5 nowych animacji na kwartał** — reszta reużywa istniejących

**Zakaz:** animacje inline w JSX (`style={{ animation: '...' }}`).
Kaźdy animation name idzie przez `index.css`.

---

## Dark mode — zasady

### Jak działa

Light/dark przełącza klasę `.dark` na `<html>`. Tokeny w `:root` i `.dark`
nadają wartości. Tailwind generuje klasy z tokenów przez `@theme`.

### Reguły

1. **Każdy kolor** idzie przez CSS variable — zero hardkodów w Tailwind classes
2. **`bg-[#hex]`** jest zakazane — używaj `bg-surface`, `bg-surface-solid`, `bg-background`
3. **`dark:bg-[#hex]`** jest zakazane — tokeny już mają dark overrides
4. Komponent nie powinien wiedzieć czy jest dark czy light — powinien używać tokenów

### Testowanie

Przy każdej zmianie UX: sprawdź w obu motywach. Tokeny mogą się rozjechać
między light a dark (inny kontrast, inna czytelność).

---

## Responsive — zasady

### Breakpointy

| Nazwa | Tailwind | Kiedy |
|---|---|---|
| Mobile | default (<640px) | Telefon |
| Tablet | `sm:` (≥640px) | Tablet, small desktop |
| Desktop | `md:` (≥768px) | Desktop |
| Wide | `lg:` (≥1024px) | Szeroki ekran |

### Reguły

1. **Mobile-first** — style bazowe dla mobile, `sm:`/`md:`/`lg:` dodają desktop
2. **Touch targets** — każdy clickable element ≥44px (Apple HIG) / ≥48px (Material)
3. **Modal na mobile** — bottom sheet (`items-end`), na desktop center (`sm:items-center`)
4. **Sidebar na mobile** — ukryta (`hidden md:flex`) lub bottom nav
5. **Testuj na 3 viewportach** przed merge: 375px (iPhone), 768px (iPad), 1280px (desktop)

---

## Jak dodawać nowy feature

### Checklist przed kodowaniem

- [ ] Czy feature potrzebuje nowego shared component? → `ui/`
- [ ] Czy feature potrzebuje nowego CSS? → `components/<feature>/<feature>.css`
- [ ] Czy feature ma overlay/modal? → `ui/Modal.tsx`, NIE własny `fixed inset-0`
- [ ] Czy feature ma empty state? → `ui/EmptyState.tsx`
- [ ] Czy feature ma loading? → `ui/Spinner.tsx` + `ui/Skeleton.tsx`
- [ ] Czy feature ma potwierdzenie? → `ui/ConfirmDialog.tsx`
- [ ] Czy feature używa tokenów zamiast hardkodów? → `bg-surface` nie `bg-[#141414]`

### Checklist przed merge

- [ ] Zero nowych `fixed inset-0` (grep: `fixed inset-0`)
- [ ] Zero nowych `window.alert/confirm` (grep: `window.alert`, `window.confirm`)
- [ ] Zero nowych `bg-[#` hardkodów (grep: `bg-\[#`)
- [ ] Zero nowych `animate-spin` inline (grep: `animate-spin` poza `Spinner.tsx`)
- [ ] `index.css` < 550 linii (grep: `wc -l src/index.css`)
- [ ] Działa w light i dark mode
- [ ] Działa na mobile (375px) i desktop (1280px)

---

## Przyszłe componenty do dodania (kolejność)

| Priorytet | Component | Gdzie | Kiedy dodać |
|---|---|---|---|
| P0 | `EmptyState.tsx` | `ui/` | Teraz — zastąpi 28× inline |
| P0 | `Spinner.tsx` | `ui/` | Teraz — zastąpi 3× inline |
| P0 | `ConfirmDialog.tsx` | `ui/` | Teraz — zastąpi 2× mechanizm |
| P1 | `Skeleton.tsx` | `ui/` | Po P0 — placeholder ładowania |
| P1 | `Badge.tsx` | `ui/` | Po P0 — notyfikacje, tagi, countery |
| P1 | `Tabs.tsx` | `ui/` | Po P0 — przełącznik widoków |
| P2 | `Select.tsx` | `ui/` | Po P1 — dropdown |
| P2 | `Tooltip.tsx` | `ui/` | Po P1 — podpowiedzi |
| P3 | `BottomSheet.tsx` | `ui/` | Po P2 — mobile-specific overlay |

---

## Review UX — co sprawdza agent

Przy przeglądzie kodu (PR review, audyt):

1. **grep `fixed inset-0`** — każdy trafiony plik (oprócz `ui/Modal.tsx`) to finding
2. **grep `window.alert\|window.confirm`** —每个 trafiony plik to finding
3. **grep `bg-\[#`** — każdy trafiony plik to finding (chyba że w `index.css` tokeny)
4. **grep `animate-spin`** — każdy plik oprócz `ui/Spinner.tsx` to finding
5. **`wc -l src/index.css`** — >550 = critical
6. **Sprawdź motyw** — otwórz w light i dark, czy kolory się zgadzają
7. **Sprawdź mobile** — resize do 375px, czy modal jest na dole, czy sidebar jest ukryty

---

## Ewolucja dokumentu

Ten plik jest żywy. Aktualizuj go gdy:
- Dodajesz nowy shared component do `ui/`
- Odkryjesz nowy pattern który powinien być znormalizowany
- Zmieniają się zasady (np. nowe breakpointy, nowe tokeny)

Data ostatniej weryfikacji z kodem: 2026-07-10
