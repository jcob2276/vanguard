# Zadanie: Sweep kart na `ui/Card` / `.surface-card`

> Brief do wykonania przez agentów. Cel: każdy hand-rolled "card div" (`rounded-* border shadow-*` pisane ręcznie w JSX) w `src/components/` ma zacząć korzystać z jednego z dwóch wspólnych mechanizmów opisanych niżej — żeby zmiana promienia/cienia/koloru karty w jednym miejscu propagowała się na całą apkę.
>
> Kontekst: `docs/DESIGN_SYSTEM.md` (filozofia, tokeny), `docs/FRONTEND_GUIDE.md` §9-13 (organizacja kodu, reguły refaktoringu, klasyfikacja ryzyka). Przeczytać oba przed startem.

## 0. Polityka `todo/` i `notes/` — dotyczy WSZYSTKICH primitive'ów (Card, Button, Badge), nie tylko kart

`notes/` (a konkretnie `notes.css` / `.keep-card` / `.btn-press`) to **źródło wzorca** który wypromowaliśmy do `index.css` (`.surface-card` itd.) — jego CSS zostaje nietknięty, bo to jest referencja, nie cel migracji.

Ale to **nie znaczy "nie ruszać żadnego przycisku w `todo/`/`notes/`"**. Rozróżnienie:

- **Struktura wizualna karty/przycisku** (`.keep-card`, `.btn-press`, customowe klasy w `notes.css`/`todo.css`) — **zostaje**, to jest źródło prawdy, nie kopiuj go na `ui/Card`/`ui/Button` na siłę.
- **Proste, generyczne CTA-przyciski** wewnątrz tych modułów (np. przycisk "Zapisz", "Anuluj", "Dodaj" bez specjalnej mechaniki) — **migrować na `ui/Button`**, tak samo jak wszędzie indziej. Fakt że plik jest w `todo/`/`notes/` nie czyni zwykłego przycisku wyjątkiem.
- **Wyspecjalizowane elementy interaktywne** (checkbox stylizowany jako przycisk, drag handle, custom gesture target, coś co ma unikalną mechanikę specyficzną dla danego widoku) — **zostawić jako `<button>`**, `ui/Button`'s API (variant/size/icon/loading) nie jest do tego zaprojektowane i próba wciśnięcia tam takiego elementu tylko zaciemni kod.

**Skrót decyzji:** pytanie nie brzmi "czy to jest w `todo/`/`notes/`", tylko "czy to jest zwykły przycisk z etykietą, czy wyspecjalizowany widget". Pierwsze → `ui/Button`. Drugie → zostaje.

---

## 1. Dwa dostępne mechanizmy — kiedy który

### A) `ui/Card.tsx` (komponent React)
Import: `import { Card } from '../../ui/Card'` (ścieżka względna do `src/components/ui/Card.tsx`).

```tsx
export type CardVariant = 'glass' | 'immersive' | 'canvas' | 'receipt' | 'outline';

<Card variant="glass" onClick={fn} className="..." padding="1.25rem">
  {children}
</Card>
```

- `variant="glass"` (domyślny) — jasna/ciemna powierzchnia, `var(--radius-lg)` (24px), `var(--shadow-card)`. Najczęstszy wybór — dashboard tiles, panele.
- `variant="immersive"` — ciemne tło `#0A0A0A` niezależnie od motywu, `var(--shadow-float)` (mocniejszy cień). Do elementów które mają wyróżniać się z otoczenia (hero card, feature spotlight).
- `variant="canvas"` — jak `glass` + subtelny wzór kropek w tle. Do miejsc z dużą ilością pustej przestrzeni (empty-state-adjacent karty, placeholder).
- `variant="receipt"` — przezroczyste tło, sam border, brak cienia. Do list/wierszy które mają wyglądać lekko (np. lista transakcji, log).
- `variant="outline"` — jak `receipt` ale bardziej widoczny border. Do kart drugorzędnych/nieaktywnych.
- `onClick` automatycznie dodaje `cursor-pointer` + press-feedback `active:scale-[0.98]` — **nie dodawaj własnego `active:scale-*` obok**.
- `padding` przyjmuje string CSS (domyślnie `'1rem'`) — użyj jeśli potrzebujesz innego niż domyślny.

**Użyj `ui/Card` gdy**: karta jest samodzielnym, wyraźnie wydzielonym blokiem UI (dashboard tile, panel, pojedynczy element listy z wyraźną ramką) — czyli tam gdzie i tak renderowałbyś jeden `<div>` na "kartę".

### B) `.surface-card` (klasa CSS, `src/index.css:178-197`)
```tsx
<div className="surface-card p-4">
  {children}
</div>
```
Dwuwarstwowy miękki cień + hover-lift (`translateY(-2px) scale(1.005)`) + press-feedback (`scale(0.99)` na `:active`) — wzorzec wyciągnięty z `notes.css` (`.keep-card`), bez własnego paddingu wbudowanego (dodaj `p-*` z Tailwinda).

**Użyj `.surface-card` gdy**: potrzebujesz karty w kontekście gdzie komponent React byłby przesadą (np. karta wewnątrz mapowanej listy z dużą ilością customowego layoutu wewnątrz, gdzie `Card`'s `variant` system nie pasuje 1:1) — albo gdy chcesz zachowania hover-lift którego `ui/Card` nie ma (żaden wariant `ui/Card` nie ma dziś `translateY` na hover, tylko `.surface-card` to robi).

**Nie twórz trzeciej opcji.** Jeśli żaden z wariantów `Card` ani `.surface-card` nie pasuje — zatrzymaj się i zapytaj, nie wymyślaj nowej klasy/komponentu.

---

## 2. Jak znaleźć kandydatów

```bash
# Pliki z ręcznie pisanym card-shape (przybliżone, wymaga ręcznego przeglądu wyników)
grep -rlE "rounded-(xl|2xl|3xl|\[[0-9]+px\]).*border" src/components --include="*.tsx"

# Pliki już używające ui/Card (nie ruszać bez potrzeby, już zrobione)
grep -rl "from '.*ui/Card'" src/components --include="*.tsx"

# Pliki używające starej CSS klasy .card (21+ konsumentów, osobny byt — patrz sekcja 4)
grep -rl "\bcard\b" src/components --include="*.tsx" | grep -v "ui/Card"
```

Nie każdy trafiony plik to faktycznie "karta do migracji" — patrz sekcja 5 (czego NIE ruszać).

---

## 3. Kolejność (batch per domena, z `docs/DESIGN_SYSTEM.md`/planu)

Małe/izolowane domeny najpierw (walidacja wzorca), duże na koniec:

1. `settings/`, `integrations/` — **całkowicie nietknięte, zacznij tutaj**
2. `identity/`, `ai/` — **całkowicie nietknięte**
3. `cards/`, `widgets/` — **całkowicie nietknięte** (uwaga: `cards/` to fabryka renderująca różne typy kart — `CardFactory.tsx` już używa `ui/Card`, ale leaf renderery `entities/`, `visual/`, `temporal/`, `textual/`, `quantifiable/` nie; potraktuj każdy leaf renderer jako osobny mini-plik do zmigrowania)
4. `correlations/`, `biometrics/`, `medical/` — dotknięte śladowo (1-5 plików), duża część nadal ad-hoc
5. `growth/`, `insights/`, `calendar/` — częściowo dotknięte (Button sweep), karty nadal ad-hoc
6. `lifestyle/`, `projects/` — częściowo dotknięte, `projects/` to najgorszy offender pod względem chaosu radiusów (sprawdź `ProjectCardExpanded.tsx` jako przykład tego czego unikać)
7. `desktop/`, `core/` — największe, najbardziej dotknięte już przez Button-sweep; karty wciąż do zrobienia

**Jedna domena = jeden commit.** Nie łącz kilku domen w jeden commit — jeśli coś się posypie, cofnięcie ma być tanie.

---

## 4. Czego NIE ruszać

- **`src/components/notes/notes.css` i pliki w `notes/`** — to jest wzorzec referencyjny (`.keep-card`), z którego `.surface-card` został wyciągnięty. Zostaje nietknięty, nie "ulepszaj" go pod nowy system.
- **21+ istniejących konsumentów starej klasy CSS `.card`** (nie `ui/Card`, tylko klasa `.card` z `index.css:156-175`) — to inny, starszy byt. Nie zamieniaj ich na `.surface-card`/`ui/Card` w ramach tego zadania — to osobna decyzja architektoniczna, nie w zakresie tego sweep'u. Zostaw jak jest.
- **Pliki na liście `LEGACY_FILES`** w `eslint.config.js` i `scripts/ops/legacy-lines-baseline.json` — sprawdź obie listy przed edycją. Jeśli plik tam jest, każda zmiana linii wymaga zaktualizowania baseline w tym samym commicie (patrz sekcja 6) — i **nigdy nie zwiększaj** limitu, tylko zmniejszaj.
- **Elementy które nie są kartami mimo pasującego wzorca grep**: przyciski (`rounded-xl border` na `<button>` — to już powinno być `ui/Button`, nie karta), chip/tag/badge (małe, inline elementy — to `ui/Badge`, osobne zadanie, nie ten sweep), inputy/formularze, kontenery wykresów w `widgets/` (mają często legit powód do własnego kształtu — sprawdź czy to faktycznie "karta" czy tylko wrapper na canvas/SVG).
- **`ui/Modal.tsx` i pochodne** (`.ios-surface`) — modale mają swój osobny system, nie mieszaj z kartami.
- **Rzeczy z gestami/drag-and-drop/custom DOM manipulation** (np. przeciągalne karty w kanbanie) — zmiana samego stylu jest OK, ale NIE zmieniaj struktury DOM/eventListenerów przy okazji. Jeśli plik ma `onDrag*`/`draggable`/`getSelection`/`execCommand` — klasyfikuj jako wysokie ryzyko (patrz sekcja 6), rób osobno, z pełną weryfikacją wizualną.

---

## 5. Proces per plik

1. Zidentyfikuj hand-rolled card div — typowy wzorzec do zastąpienia:
   ```tsx
   // PRZED
   <div className="rounded-2xl border border-border-custom bg-surface p-4 shadow-sm hover:shadow-md transition-shadow">
     {content}
   </div>
   ```
2. Zdecyduj `ui/Card` czy `.surface-card` (sekcja 1).
3. Zamień, zachowując wszystkie **funkcjonalne** propsy (`onClick`, `key` w listach, `data-*`, aria-atrybuty) — migrujesz tylko warstwę wizualną.
4. **Nie zmieniaj treści/layoutu wewnątrz karty** — tylko zewnętrzny kontener. To zadanie dotyczy kart jako powierzchni, nie ich zawartości.
5. Jeśli oryginalny div miał hover-effect różny od tego co daje `.surface-card`/`Card` (np. `hover:border-primary` zamiast `translateY`) — zachowaj **intencję** (coś się dzieje na hover) ale ujednolić **mechanikę** do wspólnego wzorca, nie zostawiaj dwóch equeal-ważnych efektów hover na tym samym elemencie.

---

## 6. Weryfikacja — obowiązkowa po każdym batchu (domenie)

W tej kolejności, napraw przed przejściem dalej:

1. `npm run typecheck:ui` (`tsc --noEmit`) — zero nowych błędów. Porównaj z listą znanych pre-existing błędów (GeneralView.tsx, PowerList*.tsx, TodoPicker.tsx — te są stare, niezwiązane, nie Twoja odpowiedzialność).
2. `npx eslint <dotknięte pliki>` — zero nowych błędów/warningów.
3. `node scripts/ops/check-frontend-ratchets.mjs` (albo `npm run ratchet:frontend`) — musi być w pełni zielone. Jeśli coś urosło ponad baseline (np. plik z `LEGACY_FILES` przekroczył limit linii) — albo cofnij zmianę, albo świadomie obniż/podnieś baseline w tym samym commicie z wyjaśnieniem dlaczego.
4. **Wizualny check w przeglądarce** — odpal dev server, wejdź na dotknięty ekran, sprawdź: desktop + mobile viewport, light + dark mode. Minimum 1 zmigrowany plik na batch obowiązkowo, więcej jeśli batch ma pliki z gestami/drag.
5. `npm run test` — 140/140 (albo aktualna liczba) musi przejść.

Dopiero po zielonym wyniku wszystkich 5 punktów — commit.

---

## 9. Przed napisaniem raportu "gotowe" — obowiązkowy self-check

**To jest najczęstsza przyczyna błędnych raportów w tym zadaniu — nie pomijaj tego kroku.** Wielokrotnie zdarzało się, że raport deklarował domenę jako zrobioną (np. "Faza 1: settings/integrations/ai: 4 karty"), a w rzeczywistości `settings/` miało zero zmian — bo raport został napisany na podstawie tego co *planowano* zrobić, nie tego co faktycznie się stało w kodzie.

**Zanim napiszesz raport, dla KAŻDEJ domeny którą zamierzasz wymienić jako "zrobioną":**

```bash
# 1. Potwierdź że domena faktycznie ma zmiany w working tree
git status --short | grep "src/components/<domena>/"

# 2. Potwierdź że faktycznie używa ui/Card (nie tylko że plik był "dotknięty" z innego powodu)
grep -rl "from '.*ui/Card'" src/components/<domena> --include="*.tsx"

# 3. Policz ile plików z domeny WCIĄŻ ma hand-rolled card-shape (żeby nie zgłosić 100% pokrycia gdy jest np. 30%)
grep -rlE "rounded-(xl|2xl|3xl|\[[0-9]+px\]).*border" src/components/<domena> --include="*.tsx" | grep -vFf <(grep -rl "from '.*ui/Card'" src/components/<domena> --include="*.tsx")
```

**Zasada:** jeśli krok 1 albo 2 zwraca pustą listę dla domeny którą chcesz zgłosić jako "✅" — **nie zgłaszaj jej**. Napisz raport dokładnie takim jaki jest wynik tych komend, nie taki jaki *miał być* plan. "Zaplanowane do zrobienia" i "zrobione" to dwie różne rzeczy — rozdziel je jawnie w raporcie (osobne sekcje albo osobne kolumny w tabeli).

Duże batch'e (wiele domen w jednej turze) zwiększają ryzyko pominięcia czegoś — jeśli robisz więcej niż 3 domeny naraz, ten self-check jest tym bardziej obowiązkowy, nie opcjonalny.

**Dodatkowo — zanim zaczniesz edytować plik, sprawdź czy `<Card>` (albo inny nowy import) jest faktycznie zaimportowany, jeśli go używasz.** W tej sesji trzykrotnie zdarzył się dokładnie ten sam bug: `<Card ...>` wstawione do JSX bez dodania `import { Card } from '.../ui/Card'` na górze pliku — co psuje `tsc`/build dla całego pliku (i czasem maskuje inne błędy typów w tym samym module, bo kompilator przestaje analizować dalej). Po każdej edycji dodającej `<Card>`/`<Button>`/`<Badge>`/`<Fab>` sprawdź `npx tsc --noEmit -p .` na całym projekcie, nie tylko na dotkniętym pliku — błąd w jednym pliku potrafi ukryć/odsłonić błędy w zupełnie innych plikach.

---

## 7. Commit convention

Jedna domena = jeden commit, format:
```
refactor(<domena>): migrate card surfaces to ui/Card / .surface-card
```
np. `refactor(settings): migrate card surfaces to ui/Card / .surface-card`.

Jeśli w ramach domeny trzeba było obniżyć/podnieść jakiś ratchet baseline — wyjaśnij dlaczego w treści commit message, nie tylko w tytule.

---

## 8. Kiedy się zatrzymać i zapytać

- Plik nie pasuje jednoznacznie do żadnego wariantu `Card` ani do `.surface-card`.
- Plik jest na `LEGACY_FILES` i zmiana istotnie zwiększa jego rozmiar (nie tylko o 1-2 linie).
- Element ma gesty/drag-and-drop i nie jesteś pewien czy zmiana stylu nie wpłynie na logikę.
- Widzisz coś co wygląda jak duplikat pracy już zrobionej przez innego agenta w tej samej sesji (sprawdź `git status`/`git log` przed startem żeby nie nadpisać czyjejś świeżej roboty).
