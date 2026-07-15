# Vanguard OS — Design System

> **Cel tego pliku:** jedno miejsce które agent (AI lub człowiek) czyta PRZED dotknięciem kodu UI.
> Zawiera twarde reguły, kompletną listę tokenów i komponentów z propami.
>
> **Visual preview:** `/dev/design-system` — żywa galeria wszystkich wariantów (uruchom dev server).

---

## 0. Twarde reguły (agent + reviewer)

**Nigdy nie pisz:** `<button className="bg-primary text-white ...">`
**Zawsze używaj:** `<Button variant="primary">`

**Egzekucja:** ESLint `no-restricted-syntax` blokuje:
- **Każdy `<button>` poza `ui/`** → `<Button variant="...">` (guard strukturalny)
- `bg-rose-500`, `text-blue-400` itd. (hardkodowane kolory palety) → tokeny `bg-danger`, `text-info`
- `rgba(99,102,241,...)` / `rgba(79,70,229,...)` w className → tokeny `--primary-N` lub `color-mix()`
- `shadow-primary` na dowolnym elemencie → `<Button variant="primary">`
- `bg-primary + text-white + px/py` → `<Button variant="primary">`

**Wyjątki (NO_BUTTON_GUARD_EXCEPTIONS):** pliki gdzie `<button>` jest jedynym sensownym wyborem — drag handle, przełącznik zakładek, złożony widget interaktywny. Każde wyłączenie musi być uzasadnione w komentarzu i trafia do listy w `eslint.config.js`.

| ❌ Nie rób tego | ✅ Zamiast tego |
|---|---|
| `<button className="bg-rose-500 ...">` | `<Button variant="danger">` |
| `<div className="rounded-2xl border ... shadow">` (karta) | `<Card variant="glass">` |
| `<div className="fixed inset-0 z-50 ...">` (modal) | `<Modal isOpen={...} onClose={...}>` |
| `<div className="animate-spin rounded-full ...">` | `<Spinner size="md" />` |
| `<div className="animate-pulse ...">` (ładowanie) | `<Skeleton variant="text" />` |
| `bg-blue-500`, `text-rose-400`, `border-emerald-200` w className | Tokeny: `bg-danger`, `text-success`, `bg-surface-2` |
| `<span className="inline-flex items-center ... badge">` | `<Badge variant="count" count={5} />` |

**Dlaczego:** komponenty zapewniają spójne rozmiary, animacje, dark mode, accessibility. Raw HTML powoduje regresje (brak scale-on-active, brak a11y, brak dark mode).

---

## 1. Filozofia

- **Pixel/Material jako baza**: tonal surfaces, czytelna hierarchia kontenerów, promienie 8–16px i spokojny emphasized motion.
- **iOS tylko dla gestów i sheetów**: płynność, interruptibility i większy promień 28px zostają tam, gdzie wynikają z fizyki interakcji.
- **Zero dekoracji dla dekoracji.** Gęstość danych > efekciarstwo.

### 1.1 Zasady projektowania komponentów

Siedem reguł, które decydują "jak wygląda dobry komponent w Vanguardzie" — niezależnie kto go pisze. Nowy komponent w `ui/` sprawdzany jest względem tej listy, nie tylko względem tego czy działa.

1. **Materialna uczciwość.** Afordancja klikalności przez kolor/kontrast/typografię, nie przez fałszywą głębię. Karty różnicują się przez `border` + przesunięcie tła (`--surface-2/3`), nie przez `box-shadow` na każdej z osobna. Cień/blur (`--shadow-float`, `.ios-glass-*`) zarezerwowany **tylko** dla naprawdę pływających warstw (modal, FAB, toast, sheet, sticky nav) — nigdy dla zwykłej karty w liście.
2. **Kształt jest funkcją rozmiaru, nie wyborem.** Promień wynika z tego, czym jest element (§2.4), nikt nie wpisuje dowolnego `rounded-[13px]`. Egzekwowane przez guard, ale to jest w pierwszej kolejności zasada projektowa.
3. **Dyscyplina stanu.** Każdy interaktywny element ma te same 4 stany zdefiniowane raz na poziomie prymitywu (`ControlPrimitives`/`Button`), nie per-komponent: hover (kolor), active (`scale(0.97)`, 0ms opóźnienia), focus (widoczny ring), disabled (opacity 0.4–0.5 + `cursor-not-allowed`).
4. **Treść jest bohaterem, chrome jest tłem.** Komponent wyświetlający dane (liczba, status, wykres) maksymalizuje wizualny ciężar danych i minimalizuje ozdobniki wokół nich — patrz `.stat-hero-number` / `ui/StatHero`. Dotyczy nie tylko statystyk: też np. jak `Badge` pokazuje status, jak `Card` pokazuje nagłówek.
5. **Ikony jako jeden system.** Jedna grubość obrysu w `lucide-react`, jeden rozmiar powiązany ze skalą tekstu obok (nie `size={13}` w jednym miejscu i `size={16}` dla tej samej hierarchii gdzie indziej), nigdy filled+outline zmieszane na tym samym poziomie hierarchii.
6. **Ruch ma znaczenie, nie dekorację.** Przed dodaniem animacji: *jak często użytkownik to zobaczy?* Element używany dziesiątki razy dziennie (checkbox w Todo, tab switch) — animacja prawie niewidoczna (100–150ms) albo żadna. Element rzadki (onboarding, pierwsza konfiguracja, pusty stan) — może mieć charakter. Nie każdy nowy komponent dostaje "fajną" animację niezależnie od kontekstu użycia.
7. **Zero komponentu bez tokenów.** Nowy komponent nigdy nie zaczyna się od "jaki kolor" — zaczyna się od "który semantyczny token pasuje" (`--primary`, `--color-danger`, `--surface-tonal`). Wybór koloru to wybór *roli*, nie wartości. Egzekwowane przez ESLint guard (§0), ale to jest źródłowa zasada, guard to tylko siatka bezpieczeństwa.

---

## 2. Tokeny (`src/index.css`)

Źródło prawdy: `src/index.css` → `:root`, `.dark`, `@theme`. Nie twórz nowych tokenów bez uzasadnienia.

### 2.1 Semantic status tokens

Tailwind klasy: `bg-success`, `text-danger`, `border-warning`, `bg-info` itd.

| Token (light) | Wartość | Kiedy używać |
|---|---|---|
| `--color-success` | `#10B981` | Pozytywny wynik, gotowe, OK |
| `--color-success-hover` | `#059669` | Hover na success |
| `--color-warning` | `#F59E0B` | Uwaga, pośredni stan, pending |
| `--color-warning-hover` | `#d97706` | Hover na warning |
| `--color-danger` | `#F43F5E` | Błąd, krytyczne, usuwanie |
| `--color-danger-hover` | `#e11d48` | Hover na danger |
| `--color-info` | `#3b82f6` | Inforamcja, neutralny akcent |
| `--color-info-hover` | `#2563eb` | Hover na info |

Dark mode: `info → #6366f1`, `success-hover → #34d399`, `warning-hover → #fbbf24`, `danger-hover → #fb7185`, `info-hover → #818cf8`.

### 2.2 Surface tokens

| Token (light) | Wartość | Kiedy używać |
|---|---|---|
| `--surface-1` | `var(--surface)` = `#ffffff` | Baza — karty, panele (to samo co `--surface`) |
| `--surface-2` | `#f1f5fb` | Lekko podniesiona — hover, inset sections |
| `--surface-3` | `#e8eef8` | Najbardziej podniesiona — aktywne/selected |
| `--surface-tonal` | jasny niebieski container | Aktywne taby, nawigacja, tonal CTA |
| `--surface-tonal-strong` | mocniejszy niebieski container | Hover na tonal surface |

Dark mode: `surface-2 → rgba(255,255,255,0.03)`, `surface-3 → rgba(255,255,255,0.06)`.

Tailwind: `bg-surface-1`, `bg-surface-2`, `bg-surface-3`.

### 2.3 Text tokens

| Token | Wartość | Kiedy używać |
|---|---|---|
| `--text-primary` | light: `#0f172a`, dark: `#f9fafb` | Główny tekst, nagłówki |
| `--text-secondary` | light: `#475569`, dark: `#9ca3af` | Opisy,wtórne info |
| `--text-muted` | light: `#94a3b8`, dark: `#818999` | Metadata, hinty, timestampy |
| `--text-tertiary` | `#99A1AF` | Najbardziej wyblakły tekst |

Tailwind: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-tertiary`.

### 2.4 Radius tokens

| Token | Wartość | Do czego |
|---|---|---|
| `--radius-sm` | `8px` | Tagi, chipy, badge |
| `--radius-md` | `12px` | Przyciski, inputy |
| `--radius-lg` | `16px` | Karty, panele |
| `--radius-xl` | `28px` | Modale, sheety |
| `--radius-full` | `9999px` | Pill shape |

### 2.5 Shadow tokens

| Token | Do czego |
|---|---|
| `--shadow-card` | Baza cienia kart |
| `--shadow-card-hover` | Cień karty na hover |
| `--shadow-card-accent` | Akcentowany cień karty |
| `--shadow-event-card` | Karty wydarzeń |
| `--shadow-float` | Unoszące się elementy (modale, FAB) |
| `--shadow-nav` | Nawigacja (sticky headers) |
| `--shadow-back-btn` | Przycisk wstecz |
| `--shadow-focus` | Focus ring na inputach (0 0 0 3px primary) |
| `--shadow-glow-primary` | Glow aktywnej zakładki/CTA |
| `--shadow-accent-active` | Cień aktywnego panelu/strefy |

### 2.6 Motion tokens

| Token | Wartość | Kiedy |
|---|---|---|
| `--spring` | `cubic-bezier(0.2, 0, 0, 1)` | Pixel emphasized motion bez dekoracyjnego overshootu |
| `--ease-out` | `cubic-bezier(0, 0, 0, 1)` | Press, hover i krótkie wyjścia |
| `--motion-fast` | `120ms` | Press i hover |
| `--motion-medium` | `200ms` | Tab, karta, search |
| `--motion-slow` | `300ms` | Modal i większa zmiana powierzchni |

### 2.7 Font stack

| Token | Font | Do czego |
|---|---|---|
| `--font-sans` | Plus Jakarta Sans, Inter, system-ui | Body, UI tekst |
| `--font-display` | Cabinet Grotesk, Outfit, system-ui | Nagłówki, labelki |
| `--font-mono` | Geist Mono, JetBrains Mono | Dane liczbowe, timery |

### 2.8 Typography scale

Nigdy nie pisz `text-[10px]` — używaj tokenu. Skala poniżej definiuje **kiedy哪.rozmiar**:

| Token | Size | Kiedy używać |
|---|---|---|
| `text-3xs` | 7px | Progress bar annotations, micro-labels |
| `text-2xs` | 9px | Status badges, uppercase metadata, pixel-label, flagi |
| `text-xs` | 11px | Labels, secondary metadata, list items, form labels |
| `text-sm` | 13px | Form inputs, descriptions, body text |
| `text-base` | 15px | Section headers, primary body |
| `text-lg` | 18px | Headings, card titles |
| `text-xl` | 20px | Large headings |
| `text-2xl` | 24px | Display numbers, hero text |
| `text-3xl` | 30px | Hero headings |
| `text-4xl` | 36px | Hero large |
| `text-5xl` | 48px | Splash |
| `text-6xl` | 56px | Splash large |

**Zasada:** 80% przypadków to `text-2xs`–`text-sm` (dane, dashboardy, KPI). Większe rozmiary tylko dla nagłówków i hero.

### 2.9 Glass Material Hierarchy

Trzy poziomy szkła, każdy z własnymi tokenami blur/saturate/bg/border:

| Level | Klasa | Blur | Saturate | BG opacity | Border | Do czego |
|-------|-------|------|----------|------------|--------|----------|
| 1 — Structural | `.glass-structural` | 24px | 160% | 85% surface | full border | Sidebar, bottom-nav |
| 2 — Elevated | `.glass-elevated` | 16px | 180% | 75% surface | 60% border | Header, toolbar, sticky |
| 3 — Floating | `.glass-floating` | 12px | 200% | 65% surface | 40% border | Modal, sheet, popover |

**Tokeny:** `--glass-blur-{1,2,3}`, `--glass-saturate-{1,2,3}`, `--glass-bg-{1,2,3}`, `--glass-border-{1,2,3}`

**Drzewo decyzyjne:**
- Element jest **stale widoczny** (sidebar, bottom-nav) → `glass-structural`
- Element jest **przyklejony** (header, toolbar) → `glass-elevated`
- Element **pojawia się nad treścią** (modal, sheet, dropdown) → `glass-floating`
- Zwykła karta w liście → **nie używaj glass**, użyj `Card variant="surface"`

**Kiedy NIE używać glass:** karty w listach, elementy inline, elementy bez tła za sobą (glass wymaga contentu pod spodem żeby działał blur).

---

## 3. Komponenty `src/components/ui/`

### Central control contract

Globalne pokrÄ™tĹ‚a w `src/index.css` obejmujÄ… teraz:

- `--space-*` â€” gÄ™stoĹ›Ä‡ i rytm odstÄ™pĂłw,
- `--control-*`, `--touch-target` â€” wysokoĹ›ci kontrolek,
- `--sidebar-width`, `--content-*`, `--toolbar-height` â€” geometria aplikacji,
- `--blur-*`, `--opacity-*`, `--z-*` â€” materiaĹ‚ i warstwy,
- `--motion-*`, `--ease-*`, `--spring` â€” ruch oraz reakcja na input.

ObowiÄ…zkowe prymitywy: `Input`, `Select`, `Button`, `IconButton`, `Chip`, `Dialog`,
`Sheet`, `Card`, `DataCard`. ObowiÄ…zkowa kompozycja: `PageShell`, `PageToolbar`,
`ContentContainer`, `Section` oraz jeden z `ListPageTemplate`, `GridPageTemplate`,
`DashboardPageTemplate`, `TimelinePageTemplate`.

`npm run ratchet:frontend` mierzy zastany dĹ‚ug surowych kontrolek, arbitralnych wartoĹ›ci
i lokalnych deklaracji CSS. Liczniki nie mogÄ… rosnÄ…Ä‡; po osiÄ…gniÄ™ciu zera ratchet staje
siÄ™ bezwzglÄ™dnym guardem.

### Button

```tsx
import Button from '../ui/Button';

<Button variant="primary" size="md" icon={<Icon />} loading={false}>
  Tekst
</Button>
```

| Prop | Typ | Default | Opcje |
|---|---|---|---|
| `variant` | string | `'primary'` | `primary`, `secondary`, `outline`, `ghost`, `danger`, `tonal` |
| `size` | string | `'md'` | `sm`, `md`, `lg` |
| `loading` | boolean | `false` | Pokazuje spinner, disable |
| `icon` | ReactNode | — | Ikona obok tekstu |
| `iconPosition` | string | `'left'` | `left`, `right` |
| `disabled` | boolean | — | Native button attr |

**Kiedy哪.variant:**
- `primary` — główna akcja na ekranie (1 na ekran)
- `secondary` — drugorzędna akcja
- `outline` — alternatywa, mniej wizualna
- `ghost` — text-only, icon buttons, anulowanie
- `danger` — usuwanie, niszczące akcje
- `tonal` — delikatny fill z kolorowym tłem (empty state actions, tagi)

### Card

```tsx
import { Card } from '../ui/Card';

<Card variant="surface" padding="1rem" onClick={() => {}}>
  {children}
</Card>
```

| Prop | Typ | Default | Opcje |
|---|---|---|---|
| `variant` | CardVariant | `'surface'` | `surface`, `glass`, `immersive`, `canvas`, `receipt`, `outline`, `notice`, `danger`, `accent` |
| `padding` | string | `'1rem'` | Dowolny CSS padding |
| `onClick` | function | — | Dodaje `cursor-pointer` + `active:scale-[0.98]` |
| `as` | ElementType | `'div'` | Polimorficzny rendering |

**Variant guide:**
- `surface` — domyślna karta, bg-surface + border + shadow (bez blur)
- `glass` — frosted glass karta z backdrop-blur (glass-elevated level)
- `immersive` — ciemne tło (#0A0A0A), float shadow
- `canvas` — kropkowane tło (dot-grid)
- `receipt` — subtelna ramka, bez shadow
- `outline` — tylko border, transparent bg
- `notice` — amber tint + border (ostrzeżenia)
- `danger` — rose tint + border (błędy, krytyczne)
- `accent` — primary tint + border (wyróżnione)

### Badge

```tsx
import Badge from '../ui/Badge';

<Badge variant="count" count={5} />
<Badge variant="dot" color="#10B981" />
<Badge variant="tag">Pilne</Badge>
```

| Prop | Typ | Default | Opcje |
|---|---|---|---|
| `variant` | string | `'count'` | `count`, `dot`, `tag` |
| `count` | number | — | Liczba (count variant), >99 → "99+" |
| `color` | string | — | Override koloru (hex) |
| `children` | ReactNode | — | Tekst (tag variant) |

### Tabs

```tsx
import Tabs from '../ui/Tabs';

<Tabs tabs={[{ key: 'a', label: 'Tab A' }]} active={active} onChange={setActive} />
```

| Prop | Typ | Default |
|---|---|---|
| `tabs` | `{ key: string; label: string; icon?: ReactNode }[]` | — |
| `active` | string | — |
| `onChange` | `(key: string) => void` | — |

### Modal

```tsx
import Modal from '../ui/Modal';

<Modal isOpen={show} onClose={() => setShow(false)} title="Tytuł" size="md">
  {children}
</Modal>
```

| Prop | Typ | Default | Opcje |
|---|---|---|---|
| `isOpen` | boolean | — | |
| `onClose` | function | — | |
| `title` | ReactNode | — | |
| `subtitle` | ReactNode | — | Pixel-label nad tytułem |
| `size` | string | `'md'` | `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `full` |
| `showCloseButton` | boolean | `true` | |
| `closeOnBackdropClick` | boolean | `true` | |
| `padding` | string | `'p-5'` | |

### Spinner

```tsx
import Spinner from '../ui/Spinner';

<Spinner size="md" />
```

| Prop | Rozmiar | Wymiary |
|---|---|---|
| `sm` | 16×16px | border-2 |
| `md` | 32×32px | border-2 |
| `lg` | 48×48px | border-3 |

### Skeleton

```tsx
import Skeleton from '../ui/Skeleton';

<Skeleton variant="text" lines={3} />
<Skeleton variant="avatar" />
<Skeleton variant="card" lines={4} />
```

| Prop | Default | Opcje |
|---|---|---|
| `variant` | `'text'` | `text`, `avatar`, `card` |
| `lines` | `3` | Liczba linii |

### EmptyState

```tsx
import EmptyState from '../ui/EmptyState';

<EmptyState icon="📭" label="Brak danych" action={{ label: 'Dodaj', onClick: () => {} }} />
```

### Input

```tsx
import Input from '../ui/Input';

<Input placeholder="Tytuł..." size="md" icon={<Search size={14} />} error="Wymagane" />
```

| Prop | Typ | Default | Opcje |
|---|---|---|---|
| `size` | string | `'md'` | `sm`, `md`, `lg` |
| `icon` | ReactNode | — | Ikona po lewej stronie |
| `error` | string | — | Komunikat błędu pod inputem |
| `disabled` | boolean | — | Native input attr |

### Fab (Floating Action Button)

```tsx
import Fab from '../ui/Fab';

<Fab onClick={handleAdd} size="md" position="bottom-right">
  <Plus size={20} />
</Fab>
```

| Prop | Default | Opcje |
|---|---|---|
| `size` | `'md'` | `sm`, `md`, `lg` |
| `position` | `'bottom-right'` | `bottom-right`, `bottom-center`, `custom` |

### CharacterAvatar

```tsx
import { CharacterAvatar } from '../ui/CharacterAvatar';

<CharacterAvatar seed="Jakub" size={36} />
```

### BrandTitle

```tsx
import { BrandTitle } from '../ui/BrandTitle';

<BrandTitle className="text-[15px]" />
```

### Workspace shell

Widoki `todo`, `keep`, `links` i `kalendarz` muszą składać wspólny szkielet z:

- `shared/WorkspaceSidebar` — stała szerokość i zachowanie responsive/collapse,
- `shared/WorkspaceNavigation` — kanoniczna kolejność czterech domen i mobile bar,
- `shared/WorkspaceHeader` — wspólna wysokość, tytuł, back oraz slot akcji,
- `shared/WorkspaceSearch` — jeden kontrakt wyszukiwania,
- `ui/Tabs` — taby widoku i filtrów bez lokalnych kopii stylu.

Komponenty domenowe dostarczają wyłącznie zawartość, stan i akcje. Nie odtwarzają
lokalnie sidebara, searcha, headera ani tabów.

---

## 4. CSS Classes (niekomponentowe)

Te klasy CSS z `index.css` są używane bezpośrednio w JSX (nie przez `ui/` komponenty):

| Klasa | Zastosowanie |
|---|---|
| `.card` | Prosty bordered container z hover-lift (21 konsumentów) |
| `.surface-card` | Dwuwarstwowy cień + hover-lift |
| `.glass-structural` | Glass level 1 — sidebar, bottom-nav (blur 24px, 85% bg) |
| `.glass-elevated` | Glass level 2 — header, toolbar, sticky (blur 16px, 75% bg) |
| `.glass-floating` | Glass level 3 — modal, sheet, popover (blur 12px, 65% bg) |
| `.pixel-tile` | Ikona w zaokrąglonym kwadracie (tonal bg) |
| `.pixel-label` | Uppercase metadata (9px, bold, tracked) |
| `.nav-pill-active` | Aktywna pozycja nawigacji |
| `.btn-primary` | CSS button (legacy — preferuj `<Button>`) |
| `.btn-outline` | CSS button outline (legacy) |

---

## 5. Motion

| Interakcja | Czas | Easing |
|---|---|---|
| Press/tap feedback | 100-160ms | `scale(0.97)` na `:active` |
| Dropdown/picker | 150-250ms | `var(--ease-out)` |
| Modal/sheet — otwarcie | 200-400ms | `var(--spring)` |
| Modal/sheet — zamknięcie | ~60-70% otwarcia | `var(--ease-out)` |
| Toast | ~300-400ms | `ease` |

**Twarde zasady:**
1. Animować tylko `transform`/`opacity`.
2. Nigdy `scale(0)` — start od `scale(0.95)`.
3. CSS transitions (nie `@keyframes`) dla przerywalnego.
4. `prefers-reduced-motion` → crossfade.

---

## 6. Accessibility

- **Kontrast**: 4.5:1 normalny tekst, 3:1 duży (WCAG AA).
- **Touch targets**: min. 44×44px, min. 8px odstęp.
- **Focus**: widoczny ring 2-4px.
- **`aria-label`** na przyciskach ikonowych.
- **Escape**: każdy modal ma cancel/back.

---

## 7. Zasady dla agentów AI

Przed napisaniem/edytowaniem kodu UI:

1. **Sprawdź czy komponent istnieje** w `src/components/ui/` zanim napiszesz nowy.
2. **Używaj tokenów** (`bg-danger`, `text-success`, `bg-surface-2`) zamiast hardkodowanych kolorów (`bg-rose-500`, `text-emerald-400`).
3. **Nigdy nie pisz `rgba(99,102,241,...)` — użyj `var(--primary-N)` lub `color-mix(in srgb, var(--primary) N%, transparent)`. To samo w inline styles i SVG attrs.
4. **Variant > boolean** — jeśli komponent ma warianty, używaj `variant="danger"` zamiast `isDanger={true}`.
5. **Preview przed commit:** uruchom `/dev/design-system` żeby zobaczyć czy nowy wariant pasuje wizualnie.
6. **Dark mode:** tokeny automatycznie się przełączają. Nie pisz `dark:bg-...` ręcznie — użyj tokena.

---

*Powiązane: [`FRONTEND_GUIDE.md`](FRONTEND_GUIDE.md) (organizacja kodu, ESLint, domeny), galeria: `/dev/design-system`*
