# Design System 10/10 — Konstytucja, moduły, zasady, plan działania

> SSOT dla wszystkiego co dotyczy wyglądu, interakcji i struktury UI w Vanguard OS.
> Każdy agent PRZED zmianą UX czyta ten plik.
> Powiązane: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (skrócona ściągawka), [FRONTEND_10_10_PLAN.md](FRONTEND_10_10_PLAN.md) (kod quality), [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) (konwencje)

---

## Definicja 10/10 (mierzalna)

Frontend jest 10/10 wizualnie gdy **wszystkie** poniższe są prawdą:

| # | Kryterium | Jak mierzone |
|---|-----------|--------------|
| 1 | Zero ręcznych overlay (`fixed inset-0`) poza `ui/Modal.tsx` | `grep "fixed inset-0" src/components/ \| wc -l` = 1 |
| 2 | `index.css` ≤ 550 linii | `wc -l src/index.css` |
| 3 | Zero hardkodów kolorów w JSX (`bg-[#hex]`) | `grep -r "bg-\[#" src/components/ \| wc -l` = 0 |
| 4 | Kaźdy empty state używa `ui/EmptyState` | `grep -r "border-dashed" src/components/ \| wc -l` = 0 |
| 5 | Kaźdy spinner używa `ui/Spinner` | `grep -r "animate-spin" src/components/ \| grep -v "Spinner.tsx" \| wc -l` = 0 |
| 6 | Kaźde potwierdzenie używa `ui/ConfirmDialog` | `grep -r "window\.alert\|window\.confirm" src/ \| wc -l` = 0 |
| 7 | Shared components w `ui/` mają testy | `ls src/components/ui/*.test.tsx \| wc -l` ≥ 6 |
| 8 | Dark mode spójny (zero `dark:bg-[#hex]`) | `grep -r "dark:bg-\[#" src/ \| wc -l` = 0 |
| 9 | Touch targets ≥44px na mobile | ręczny audit lub automated check |
| 10 | Brak inline animacji w JSX | `grep -r "animation:" src/components/ \| grep -v "\.css" \| wc -l` = 0 |

---

## Wzorcowa struktura modułu UI

### Wzorzec C — Feature Module (UI layer)

Dla każdego modułu który ma interakcje wizualne:

```
src/components/<feature>/
├── index.ts                    # fasada
├── <Feature>Container.tsx      # DANE: useQuery, stan, efekty. Zero JSX
├── <Feature>View.tsx           # WIDOK: czysty prezenter. Zero fetch
├── <Feature>.css               # CSS modułu (jeśli >0 linii niemożliwych w Tailwind)
├── components/                 # klocki TYLKO wewnątrz modułu
│   └── <SubComponent>.tsx
├── hooks/                      # logika interakcji
└── modals/                     # WSZYSTKIE używają ui/Modal
    └── <Feature>Modal.tsx
```

**Reguła:** plik z logiką danych LUB plik z JSX — nigdy oba naraz.
**Próg:** plik >300 linii LUB miesza fetch+JSX → split.

### Wzorzec D — Shared UI Component

```
src/components/ui/
├── Modal.tsx              # JEDYNY overlay w repo
├── Card.tsx               # 5 wariantów
├── EmptyState.tsx         # pusty stan
├── Spinner.tsx            # ładowanie
├── Skeleton.tsx           # placeholder
├── Badge.tsx              # notyfikacje, countery, tagi
├── Tabs.tsx               # przełącznik widoków
├── ConfirmDialog.tsx      # potwierdzenie akcji
├── Select.tsx             # dropdown
├── Tooltip.tsx            # podpowiedzi
├── BottomSheet.tsx        # mobile overlay
├── ToastHost.tsx          # toasty (globalny)
├── DetailPageLayout.tsx   # header + back + content
├── BrandTitle.tsx         # logo
├── CharacterAvatar.tsx    # avatar z initialami
└── PersonaAvatarButton.tsx # avatar button z badge
```

**Reguła:** nowy shared component → `ui/`. Nie do `shared/`, nie do `<feature>/`.

---

## Warstwy CSS — twarda hierarchia

| Warstwa | Gdzie | Co tam | Limit | Zakaz |
|---|---|---|---|---|
| **Tokeny** | `index.css :root` + `.dark` | Kolory, cienie, fonty, radiuse | ~200 linii | hardkodowanie w JSX |
| **Theme mapping** | `index.css @theme` | Mapowanie tokenów na Tailwind | ~25 linii | — |
| **Animacje** | `index.css` (po @theme) | `@keyframes` + `.animate-*` | ~80 linii | animacje inline w JSX |
| **Component classes** | `index.css @layer components` | `.card`, `.btn-primary`, `.input` | ~150 linii | — |
| **Moduł CSS** | `components/<feature>/<feature>.css` | CSS jednego modułu | brak limitu | CSS w index.css należący do jednego modułu |

**Twardy limit:** `index.css` ≤ 550 linii. Powyżej = critical.

---

## Tokeny — zasady tworzenia

### Nowy kolor
```
1. :root  w index.css:  --my-color: #hex;
2. .dark  w index.css:  --my-color: #hex;
3. @theme w index.css:  --color-my: var(--my-color);
4. Używaj: bg-my, text-my w Tailwind
```
**Zakaz:** `bg-[#hex]`, `text-[#hex]`, `dark:bg-[#hex]` w JSX.

### Nowy shadow
```
1. :root  w index.css:  --shadow-my: 0 4px 12px rgba(0,0,0,0.1);
2. .dark  w index.css:  --shadow-my: 0 4px 12px rgba(0,0,0,0.5);
3. @theme w index.css:  --shadow-my: var(--shadow-my);
4. Używaj: shadow-my w Tailwind
```

### Nowy radius
```
1. :root w index.css: --radius-my: 12px;
2. Używaj: rounded-[var(--radius-my)]
```

### Nowy font
```
1. index.html: <link> do Google Fonts
2. :root w index.css: --font-my: 'FontName', system-ui, sans-serif;
3. @theme w index.css: --font-my: var(--font-my);
4. Używaj: font-my w Tailwind
```

---

## Animacje — zasady

### Dostępne (nie twórz nowych bez powodu)

| Klasa | Efekt | Kiedy |
|---|---|---|
| `animate-fadeIn` | Fade-in-up (0.28s) | Modale, karty |
| `animate-ios-modal` | Slide-up z scale (0.38s) | Pełnoekranowe modale mobile |
| `animate-spring-right` | Slide right (0.34s spring) | Tab swipe w prawo |
| `animate-spring-left` | Slide left (0.34s spring) | Tab swipe w lewo |
| `animate-scaleUp` | Scale (0.2s spring) | Modale (w ui/Modal) |

### Nowa animacja
```
1. Nazwa: animate-<co>
2. Definicja: @keyframes <co> w index.css
3. Limit: 5 nowych animacji na kwartał
4. Zakaz: animacje inline w JSX (style={{ animation: '...' }})
```

---

## Dark mode — zasady (twarde)

1. **Każdy kolor** idzie przez CSS variable — zero hardkodów w Tailwind
2. **`bg-[#hex]`** zakazane — używaj `bg-surface`, `bg-surface-solid`, `bg-background`
3. **`dark:bg-[#hex]`** zakazane — tokeny już mają dark overrides
4. Komponent **nie powinien wiedzieć** czy jest dark czy light
5. **Testowanie:** przy każdej zmianie UX sprawdź oba motywy

### Istniejące tokeny (referencja)

| Token | Light | Dark | Użycie |
|---|---|---|---|
| `--background` | `#f8fafc` | `#030712` | tło strony |
| `--surface` | `#ffffff` | `#0b0f19` | tło kart (glass) |
| `--surface-solid` | `#ffffff` | `#111827` | tło kart (solidne) |
| `--border` | `#e2e8f0` | `rgba(255,255,255,0.06)` | ramki |
| `--text-primary` | `#0f172a` | `#f9fafb` | główny tekst |
| `--text-secondary` | `#475569` | `#9ca3af` | drugorzędny |
| `--text-muted` | `#94a3b8` | `#818999` | metadata |
| `--primary` | `#3b82f6` | `#6366f1` | primary action |
| `--primary-hover` | `#2563eb` | `#4f46e5` | hover primary |

---

## Responsive — zasady (twarde)

### Breakpointy

| Nazwa | Tailwind | Kiedy |
|---|---|---|
| Mobile | default (<640px) | Telefon |
| Tablet | `sm:` (≥640px) | Tablet |
| Desktop | `md:` (≥768px) | Desktop |
| Wide | `lg:` (≥1024px) | Szeroki ekran |

### Reguły

1. **Mobile-first** — style bazowe dla mobile, `sm:`/`md:`/`lg:` dodają desktop
2. **Touch targets** — każdy clickable ≥44px (Apple HIG)
3. **Modal na mobile** — bottom sheet (`items-end`), na desktop center (`sm:items-center`)
4. **Sidebar na mobile** — ukryta (`hidden md:flex`) lub bottom nav
5. **Testuj na 3 viewportach** przed merge: 375px, 768px, 1280px

---

## Shared Components — specyfikacja

### Modal.tsx — JEDYNY overlay

```tsx
<Modal isOpen={open} onClose={close} title="Tytuł" size="md">
  {/* treść */}
</Modal>
```

**Props:** `isOpen`, `onClose` (required), `title`, `subtitle`, `size`, `showCloseButton`, `closeOnBackdropClick`

**Zachowanie:** Escape zamyka, backdrop click zamyka, body scroll lock, `aria-modal="true"`

**Zakaz:** własny `fixed inset-0` overlay. Nie ma wyjątków.

### EmptyState.tsx — pusty stan

```tsx
<EmptyState icon="📝" label="Brak notatek" action={{ label: "Dodaj", onClick: create }} />
```

**Zakaz:** inline `border-dashed + emoji + tekst`.

### ConfirmDialog.tsx — potwierdzenie

```tsx
const ok = await confirmDialog("Na pewno usunąć?");
if (ok) { /* delete */ }
```

**Zakaz:** `window.alert()`, `window.confirm()`, własny modal potwierdzeń.

### Spinner.tsx — ładowanie

```tsx
<Spinner size="md" />  // sm | md | lg
```

**Zakaz:** inline `animate-spin rounded-full h-8 w-8`.

### Skeleton.tsx — placeholder

```tsx
<Skeleton lines={3} />           // tekst
<Skeleton variant="card" />      // karta
<Skeleton variant="avatar" />    // okrągły
```

### Badge.tsx — notyfikacje

```tsx
<Badge count={5} />                    // czerwony counter
<Badge variant="dot" />                // kropka (unread)
<Badge variant="tag" color="blue">AI</Badge>  // kolorowy tag
```

### Tabs.tsx — przełącznik

```tsx
<Tabs
  tabs={[{ key: 'dzis', label: 'Dziś' }, { key: 'tydzien', label: 'Tydzień' }]}
  active={tab}
  onChange={setTab}
/>
```

---

## Moduły CSS — kiedy co

### Twórz nowy plik CSS gdy:
- Komponent ma ≥5 linii niemożliwych w Tailwind (pseudo-elements, złożone animacje)
- Komponent ma ≥3 klasy CSS powtarzające się między elementami
- Kod CSS w `index.css` należy do jednego modułu → wynosi się

### NIE twórz nowego pliku CSS gdy:
- Wystarczy Tailwind (≥95% przypadków)
- Styl używany przez ≥2 moduły → `index.css @layer components`
- To jest token/global → `index.css :root`

---

## Jak dodawać nowy feature

### Checklist przed kodowaniem

- [ ] Czy feature potrzebuje nowego shared component? → `ui/`
- [ ] Czy feature potrzebuje nowego CSS? → `components/<feature>/<feature>.css`
- [ ] Czy feature ma overlay/modal? → `ui/Modal.tsx`, NIE własny `fixed inset-0`
- [ ] Czy feature ma empty state? → `ui/EmptyState.tsx`
- [ ] Czy feature ma loading? → `ui/Spinner.tsx` + `ui/Skeleton.tsx`
- [ ] Czy feature ma potwierdzenie? → `ui/ConfirmDialog.tsx`
- [ ] Czy feature używa tokenów zamiast hardkodów?

### Checklist przed merge

- [ ] Zero nowych `fixed inset-0` (grep: `fixed inset-0` — tylko Modal.tsx)
- [ ] Zero nowych `window.alert/confirm`
- [ ] Zero nowych `bg-[#` hardkodów
- [ ] Zero nowych `animate-spin` inline
- [ ] `index.css` < 550 linii
- [ ] Działa w light i dark mode
- [ ] Działa na mobile (375px) i desktop (1280px)
- [ ] Touch targets ≥44px

---

## Przyszłe componenty — roadmapa

| Priorytet | Component | Opis | Kiedy |
|---|---|---|---|
| **P0** | `EmptyState.tsx` | Zastąpi 28× inline | Teraz |
| **P0** | `Spinner.tsx` | Zastąpi 3× inline | Teraz |
| **P0** | `ConfirmDialog.tsx` | Zastąpi 2× mechanizm | Teraz |
| **P1** | `Skeleton.tsx` | Placeholder ładowania | Po P0 |
| **P1** | `Badge.tsx` | Notyfikacje, countery, tagi | Po P0 |
| **P1** | `Tabs.tsx` | Przełącznik widoków | Po P0 |
| **P2** | `Select.tsx` | Dropdown | Po P1 |
| **P2** | `Tooltip.tsx` | Podpowiedzi | Po P1 |
| **P3** | `BottomSheet.tsx` | Mobile overlay | Po P2 |

---

## Sesje wdrożeniowe

### DS0 — Stworzyć P0 components (~2h)

- [ ] `ui/EmptyState.tsx` — props: `icon`, `label`, `action?`
- [ ] `ui/Spinner.tsx` — props: `size: 'sm' | 'md' | 'lg'`
- [ ] `ui/ConfirmDialog.tsx` — exported `confirmDialog(message): Promise<boolean>`
- [ ] Testy: `ui/EmptyState.test.tsx`, `ui/Spinner.test.tsx`, `ui/ConfirmDialog.test.tsx`
- [ ] **DoD:** 3 komponenty istnieją, testy przechodzą

### DS1 — Zastąpić inline patterns (~3-4h, mechaniczne)

- [ ] 28× inline empty state → `ui/EmptyState` (grep: `border-dashed`)
- [ ] 3× inline spinner → `ui/Spinner` (grep: `animate-spin` poza Spinner.tsx)
- [ ] 2× mechanizm potwierdzeń → `ui/ConfirmDialog` (grep: `window.alert`, `window.confirm`)
- [ ] 19× ręczny overlay → `ui/Modal` (grep: `fixed inset-0` — zostawić Modal.tsx + ToastHost)
- [ ] **DoD:** `fixed inset-0` = 1-2 trafienia, `window.alert` = 0, `animate-spin` = 1

### DS2 — CSS cleanup (~2-3h)

- [ ] `notes.css` osobny plik (1549 linii z index.css)
- [ ] `todo.css` osobny plik
- [ ] `muscleHeatmap.css` osobny plik
- [ ] `index.css` < 550 linii po wyniesieniu
- [ ] **DoD:** `wc -l src/index.css` < 550, zero regresji wizualnej

### DS3 — Dark mode audit (~1-2h)

- [ ] `grep -r "bg-\[#" src/components/` → zamienić na tokeny
- [ ] `grep -r "dark:bg-\[#" src/` → zamienić na tokeny
- [ ] `grep -r "text-\[#" src/components/` → zamienić na tokeny
- [ ] Ręczny przegląd: każdy komponent w light i dark
- [ ] **DoD:** zero hardkodów kolorów w JSX

### DS4 — Responsive audit (~2h)

- [ ] Przegląd każdego modułu na 375px, 768px, 1280px
- [ ] Touch targets <44px → powiększyć
- [ ] Modale na mobile → bottom sheet
- [ ] Sidebary na mobile → ukryte/nav
- [ ] **DoD:** zero elementów <44px na mobile, zero overflow

### DS5 — Stworzyć P1 components (~2h)

- [ ] `ui/Skeleton.tsx` — props: `lines?`, `variant?: 'text' | 'card' | 'avatar'`
- [ ] `ui/Badge.tsx` — props: `count?`, `variant?: 'count' | 'dot' | 'tag'`, `color?`
- [ ] `ui/Tabs.tsx` — props: `tabs: {key, label}[]`, `active`, `onChange`
- [ ] Testy dla każdego
- [ ] **DoD:** 3 komponenty istnieją, testy przechodzą

### DS6 — Adopcja ciągła (zasada skauta)

Nie rób hurtem — liczniki z DS1 pilnują kierunku:
- **Nowy feature:** wyłącznie shared components z `ui/`
- **Dotykasz pliku z inline overlay:** przepnij na `ui/Modal`
- **Dotykasz pliku z inline empty state:** przepnij na `ui/EmptyState`
- **Nowy kolor:** token w `index.css`, nie `bg-[#hex]`
- **Nowa animacja:** `index.css`, nie inline

---

## Review UX — co sprawdza agent

1. `grep "fixed inset-0" src/components/` — każdy trafiony plik (oprócz Modal.tsx) = finding
2. `grep "window\.alert\|window\.confirm" src/` — każdy trafiony = finding
3. `grep "bg-\[#" src/components/` — każdy trafiony = finding
4. `grep "animate-spin" src/components/` — każdy plik oprócz Spinner.tsx = finding
5. `wc -l src/index.css` — >550 = critical
6. Sprawdź motyw: light + dark
7. Sprawdź mobile: 375px, 768px, 1280px

---

## Authority (gdy sprzeczne)

1. Ten plik — konstytucja UX
2. `DESIGN_SYSTEM.md` — skrócona ściągawka
3. `FRONTEND_10_10_PLAN.md` — kod quality
4. `FRONTEND_GUIDE.md` — ogólne konwencje frontend
5. `PRODUCT_PRINCIPLES.md` — filozofia produktu

---

## Zasada nadrzędna

**Bałagan nie powstaje przez jeden zły commit. Powstaje przez 50 "małych wyjątków" które nikt nie rejestruje.**

Każda reguła w tym dokumencie ma odpowiadający mechanizm egzekwujący (grep, test, CI).
Jeśli reguła nie ma mechanizmu — nie istnieje.

Data ostatniej weryfikacji z kodem: 2026-07-10
