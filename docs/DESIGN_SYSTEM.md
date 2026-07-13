# Vanguard OS — Design System

> Jeden spójny język wizualny: **iOS (Apple HIG) jako baza, Pixel/Material akcenty tam gdzie funkcjonalnie lepsze.**
>
> **Dlaczego ten plik istnieje:** Vanguard ma już zbudowany token layer (`src/index.css`, kilka przeszłych sesji: `e26c7727`, `a655a400`, `3d3f5fb7`, `903a4a8d`), ale poprzedni `DESIGN_SYSTEM.md` który go dokumentował został usunięty przy konsolidacji dokumentacji (`ac0d06bd`) i nigdy nie odtworzony. Adopcja tokenów w realnym kodzie jest bliska zeru (patrz sekcja 6) — nie dlatego że system jest zły, tylko dlatego że nikt go nie egzekwował. Ten plik odtwarza dokumentację i staje się punktem odniesienia dla dalszej pracy nad spójnością.
>
> Vanguard to appka jednego użytkownika z gęstymi danymi (KPI, kalendarz, treningi) — **spójność ważniejsza niż różnorodność per ekran.** To nie jest landing page.

---

## 1. Filozofia

- **iOS jako baza**: duże promienie, szklane/translucentne powierzchnie, spring animacje, dużo białej przestrzeni, subtelne cienie. Dominuje w kartach, panelach, modalach/sheetach, przyciskach.
- **Pixel/Material jako akcent**: tam gdzie iOS nie ma dobrego wzorca — tonal surfaces (ikony w kolorowych kafelkach), FAB do szybkiego dodawania, uppercase metadata labels.
- **Zero dekoracji dla dekoracji.** Gęstość danych > efekciarstwo. Noise textures, gradient mesh, custom cursory — nie tutaj (to pasuje do landing page, nie do dashboardu z KPI).

---

## 2. Fixed tokens (`src/index.css`)

Nie wymyślamy nowych wartości — to już istnieje i jest źródłem prawdy:

```css
/* ── Pixel + iOS Design Tokens ── (src/index.css:41-54) */
--radius-sm: 10px;   /* tagi, chipy, badge */
--radius-md: 16px;   /* przyciski, inputy */
--radius-lg: 24px;   /* karty, panele */
--radius-xl: 28px;   /* modale, sheety */
--radius-full: 9999px;

--tonal-primary: rgba(79, 70, 229, 0.08);        /* Pixel-style tonal surface */
--tonal-primary-strong: rgba(79, 70, 229, 0.14);

--spring: cubic-bezier(0.34, 1.56, 0.64, 1);      /* iOS-style spring easing */
--ease-out: cubic-bezier(0.25, 1, 0.5, 1);
```

Font stack (`@theme` w `index.css`):
- `--font-sans: 'Plus Jakarta Sans', 'Inter', system-ui` — body/UI tekst. Niezależnie potwierdzone jako trafny wybór przez bazę `ui-ux-pro-max` (jedyny wynik z tagiem moodu `ios dynamic type, android scaling`).
- `--font-display: 'Cabinet Grotesk', 'Outfit', system-ui` — nagłówki, labelki.
- `--font-mono: 'Geist Mono', 'JetBrains Mono'` — dane liczbowe, timery.

Spacing: brak osobnej skali tokenów — używamy standardowej skali Tailwind (4px bazowa jednostka), zgodnie z powszechną praktyką (Bencium Fixed Elements: 4/8/12/16/24/32/48/96px).

---

## 3. Tabela decyzji: iOS vs Pixel per element

| Element | Język | Klasa/token | Adopcja dziś |
|---|---|---|---|
| Karty, panele | iOS (duży radius, glass) | `.card`, `.glass-panel` | `.card` 21/324 plików, `.glass-panel` 0 |
| Sheets, modale | iOS (frosted, asymetryczny radius u góry) | `.ios-surface` | 0/324 |
| Icon tiles | Pixel (tonal square) | `.pixel-tile` | 0/324 |
| Metadata labels | Pixel (uppercase, tracked) | `.pixel-label` | nieliczone, sporadyczne |
| Przyciski | iOS press-feedback (`scale(0.97)` na `:active`) | `.btn-primary`, `.btn-outline` | `.btn-primary` 4/324 |
| Quick-add / akcja główna | Pixel FAB | *(gap — nie zbudowane, patrz sekcja 7)* | — |

**Zasada:** nowy komponent zawsze sprawdza czy pasujący token/klasa już istnieje, zanim napisze styl inline. Jeśli pasuje kilka klas na raz (np. karta ORAZ frosted) — łączymy klasy, nie duplikujemy stylu.

---

## 4. Motion — tabela czasów i easingów

Połączenie Apple "Designing Fluid Interfaces" + Emil Kowalski (design-engineering) + Bencium `MOTION-SPEC.md` — wszystkie trzy źródła zgadzają się co do rzędu wielkości, różnice tylko kosmetyczne.

| Interakcja | Czas | Easing | Źródło |
|---|---|---|---|
| Press/tap feedback (przycisk, karta) | 100-160ms | `scale(0.97)` na `:active`, transform only | Emil |
| Dropdown/picker/menu | 150-250ms | `var(--ease-out)` | Emil |
| Modal/sheet — otwarcie | 200-400ms (twardy limit <500ms) | `var(--spring)`, critically damped (damping ~1.0, response 0.3-0.4) | Apple + Emil |
| Modal/sheet — zamknięcie | szybsze niż otwarcie (~60-70%) | `var(--ease-out)` | Emil/Bencium |
| Gest z momentum (swipe-to-dismiss, flick) | zależne od prędkości | spring z bounce (damping ~0.8), velocity handoff | Apple |
| Toast | ~300-400ms | `ease`, wejście/wyjście tą samą ścieżką | Emil |

**Twarde zasady:**
1. Animować tylko `transform`/`opacity` — nigdy `width`/`height`/`padding`/`top`/`left` (layout thrashing).
2. Nigdy `scale(0)` na wejściu — start od `scale(0.95)` + `opacity: 0`. Nic w realnym świecie nie pojawia się z kompletnej nicości.
3. **Rzeczy klikane >100×/dzień (checkboxy, skróty klawiszowe) — zero albo minimalna animacja.** Animacja należy się modalom/sheetom/toastom (occasional), nie codziennym mikro-interakcjom.
4. CSS transitions (nie `@keyframes`) dla wszystkiego przerywalnego (toast, swipe) — keyframes restartują od zera przy przerwaniu, transitions retargetują płynnie.
5. Popover skaluje się z punktu wyzwolenia (`transform-origin` = trigger). Modal zawsze z centrum/dołu (nie jest zakotwiczony do triggera).
6. `prefers-reduced-motion: reduce` → crossfade zamiast slide/spring, zero transform-based motion.

---

## 5. Baseline accessibility (niezależne od stylu iOS/Pixel)

Priorytet 1-3 z bazy `ui-ux-pro-max` (CRITICAL/HIGH) — obowiązują zawsze, niezależnie od tego czy dany komponent jest "bardziej iOS" czy "bardziej Pixel":

- **Kontrast**: 4.5:1 dla normalnego tekstu, 3:1 dla dużego tekstu (WCAG AA).
- **Touch targets**: min. 44×44px, min. 8px odstępu między nimi.
- **Focus states**: widoczny ring 2-4px na elementach interaktywnych, nigdy nie usuwany.
- **`aria-label`** na przyciskach ikonowych (bez widocznego tekstu).
- **`prefers-reduced-motion`** respektowany wszędzie (patrz sekcja 4.6).
- **CLS/performance**: rezerwacja miejsca dla asynchronicznego contentu, skeleton zamiast pustego layoutu przy ładowaniu >300ms.
- **Escape routes**: każdy modal/multi-step flow ma jasny cancel/back.

---

## 6. Inwentarz `ui/` primitives

Stan na dziś (do naprawy w przyszłej sesji — Faza 1, patrz roadmapa w sekcji 8):

| Komponent | Obecny stan | Token który powinien konsumować |
|---|---|---|
| `Modal.tsx` | `rounded-[28px]` hardkod, `bg-surface shadow-xl` (brak glass), odwołuje się do **nieistniejącej** klasy `animate-scaleUp` (zepsuta animacja wejścia panelu) | `var(--radius-xl)`, `.ios-surface`, naprawiona animacja wejścia zgodna z sekcją 4 |
| `Card.tsx` | `borderRadius: 20/24` hardkod w stylach inline, własny `active:scale-[0.985]` | `var(--radius-lg)`, `scale(0.98)` (zgodność z `.card` CSS class) |
| `Spinner.tsx` | Minimalny, w miarę token-zgodny (`border-primary`) | Bez zmian pilnych — brak sparowanego Skeleton-usage-guidance |
| `Badge.tsx` | Własna implementacja, nie używa `.pixel-tile`/`.pixel-label` | `var(--tonal-primary)` zamiast `bg-primary/10` |

Dwa różne koncepty "card" współistnieją świadomie: CSS-owa klasa `.card` (21 konsumentów, prosty bordered container z hover-lift) i komponent `ui/Card.tsx` (5 wariantów, bardziej rozbudowany). **Nie scalać ich mechanicznie** — różne przypadki użycia. Token-source obie, ale zostają oddzielne.

---

## 7. Nota o kompozycji (Vercel `composition-patterns`)

Przy przebudowie `ui/` primitives: **explicit variants, nie boolean-prop proliferation.** `Card`'s `variant: 'glass' | 'immersive' | 'canvas' | 'receipt' | 'outline'` to dobry wzorzec do utrzymania i naśladowania. Nie dokładać do `Modal`/`Button` booleanów typu `isCompact`/`showHeader`/`isDanger` — zamiast tego osobny wariant albo compound component.

**Otwarty gap (nie budowany teraz):** Pixel-owy FAB do szybkiego dodawania (PowerList, Todo, Notes mają dużo "szybkiego dodawania" — naturalny kandydat na FAB zamiast przycisku w rogu). Do zaprojektowania w przyszłej sesji jako osobny `ui/` primitive, nie doklejać ad-hoc do istniejących ekranów.

---

## 8. Roadmapa (kolejne sesje)

Ten plik (Faza 0) jest docs-only. Kolejne fazy — każda z własnym checkpointem przed startem, zgodnie z regułą "jedna sesja = jeden temat = jeden commit":

- **Faza 1** — wyrównanie `ui/Modal.tsx`, `ui/Card.tsx` do tokenów z sekcji 2 (w tym naprawa zepsutej `animate-scaleUp`).
- **Faza 2** — migracja 9 plików z własnym `fixed inset-0` na `ui/Modal` (batchowane wg ryzyka).
- **Faza 3** — migracja 28 plików z własnym `animate-spin` na `ui/Spinner`/`ui/Skeleton` (batchowane wg domeny).
- **Faza 4** — audyt końcowy skillem `web-design-guidelines` (zainstalowany, `~/.claude/skills/web-design-guidelines`).

---

*Powiązane: [`FRONTEND_GUIDE.md`](FRONTEND_GUIDE.md) (organizacja kodu, reguły ESLint, mapa domen), `lessons.md` (incydenty).*
