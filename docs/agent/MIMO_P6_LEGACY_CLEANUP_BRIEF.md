# Brief dla MIMO — P6: reszta `LEGACY_FILES` (po P5)

**Zacznij dopiero po skończeniu całego P5** (MorningPlanModal ✓, CalendarGrid, LinksInbox,
TodoCard — RichEditor pomija na stałe). To jest kontynuacja tego samego długu, ale
**inny profil pracy**: nie 5 gigantów, tylko ~111 plików różnej wielkości. Nie da się
dla każdego napisać osobnego dokładnego planu jak w P5 — ten brief daje Ci **mechanizm
samodzielnej klasyfikacji + twardy checklist**, żeby nie trzeba było zgadywać ani prosić
o plan przy każdym pliku.

## Dlaczego to inny tryb niż P5

Rozkład 116 plików z `LEGACY_FILES` (bez `database.types.ts` — generowany, nigdy nie ruszaj):

| Zakres linii | Ile plików | Co to zwykle znaczy |
|---|---|---|
| 300-400 | 87 (75%!) | Lekka nadwyżka — zwykle jedno wydzielenie (hook/subkomponent/helper) wystarczy |
| 400-500 | 12 | Umiarkowany split — Container/View albo 2 hooki |
| 500-600 | 9 | Prawdziwy split, jak mniejsze pliki z P5 |
| 600-700 | 2 | Duży split, traktuj jak P5 |
| 700+ | 6 (w tym 4 z P5 minus MorningPlanModal, plus `exportStats.ts` 928 i `usePowerListData.ts` 745) | P5-poziom ostrożności |

**Wniosek: 3/4 tej listy to nie są kolejne TodoCard.tsx.** Większość to plik, który
urósł 20-90 linii ponad limit i potrzebuje jednego, oczywistego wydzielenia. Traktowanie
wszystkich 116 jak P5 (plan-first, jeden commit na plik) trwałoby miesiącami bez potrzeby.

## Mechaniczna klasyfikacja — rób to SAM, nie pytaj mnie za każdym razem

Dla każdego pliku z `legacy-lines-baseline.json` (poza już zrobionymi w P5 i poza
`database.types.ts`/`RichEditor.tsx`), policz:

```bash
# linie pliku (już masz w baseline.json)
# + czy to hook bez JSX:
grep -c "return (" plik.tsx   # 0 = prawdopodobnie czysta logika, nie widok
# + liczba stanów:
grep -c "useState\|useReducer" plik.tsx
# + gesty/DOM-manipulacja (czerwona flaga niezależnie od rozmiaru):
grep -cE "onTouch|onDrag|execCommand|getSelection|onPointerDown" plik.tsx
```

**Reguła klasyfikacji:**

- **Tier 1 (mechaniczny)**: 300-400 linii, ≤4 `useState`, 0 trafień na gesty/DOM-manip.
  Batch: **do 3 plików na commit**, jeden typ zmiany na commit (np. "wydziel helpery z
  3 plików growth/").
- **Tier 2 (umiarkowany)**: 400-600 linii LUB (300-400 z >4 `useState`). Batch: **1 plik
  na commit**, bez wymogu planu-do-akceptacji, ale pełna weryfikacja jak niżej.
- **Tier 3 (ostrożny, jak P5)**: 600+ linii LUB jakiekolwiek trafienie na gesty/DOM-manip
  niezależnie od rozmiaru. **Wymaga planu tekstowego do akceptacji przed edycją**,
  1 plik = 1 commit, wizualna/funkcjonalna weryfikacja w przeglądarce po.

Jeśli nie jesteś pewien tieru (np. plik jest 395 linii ale ma dużo logiki biznesowej) —
**zaokrąglaj w górę** (wyższy tier = więcej ostrożności), nie w dół.

## Twardy checklist — dla KAŻDEGO pliku, niezależnie od tieru

To są zasady złamane wcześniej dziś (S12, S13, i regresja w `useMorningPlanData.ts`).
Nie pomijaj żadnej, nawet dla Tier 1.

1. **Przed edycją: zlicz wywołania obsługi błędów w oryginalnym pliku:**
   ```bash
   grep -c "notify(\|console\.warn(\|console\.error(" plik.tsx
   ```
   Zapisz tę liczbę. Po rozbiciu, suma tych wywołań we WSZYSTKICH nowych plikach musi
   być **równa albo większa** (nigdy mniejsza) od oryginalnej. Jeśli mniejsza — coś
   zgubiłeś, znajdź co i przywróć. To dokładnie ten bug znaleziony w P5 #1
   (`useMorningPlanData.ts` zgubił `notify()` w catch-u ładowania danych — nie złapał
   go ani typecheck, ani lint, ani 107 testów).

2. **Po przeniesieniu/rozbiciu — sprawdź `eslint.config.js` i `legacy-lines-baseline.json`:**
   - Jeśli plik znika z `LEGACY_FILES` (bo spadł pod 300 linii) — usuń go z OBU list
   - Jeśli zostaje >300 linii (np. sam Container po rozbiciu) — zaktualizuj ścieżkę
     jeśli się zmieniła, zaktualizuj liczbę linii
   - **Nigdy nie dodawaj nowego pliku do `LEGACY_FILES`** żeby ominąć limit — to jest
     lista która ma tylko maleć, ratchet to sprawdza (`LEGACY_FILES: N / baseline M`)

3. **Weryfikacja w tej kolejności, napraw przed kolejnym plikiem:**
   ```
   npm run typecheck:ui
   npx eslint <wszystkie dotknięte pliki>
   npm run test
   npm run ratchet:frontend
   ```

4. **Dla Tier 2/3: dodatkowo sprawdź że żaden `useState`/`useEffect` nie został
   przypadkiem zduplikowany między starym a nowym miejscem** (klasyczny błąd przy
   copy-paste zamiast move — dwa źródła prawdy dla tego samego stanu).

5. **Jedna sesja = jeden commit.** Dla Tier 1 batch (do 3 plików) — nadal jeden commit,
   ale nie więcej niż 3 pliki na raz, żeby cofnięcie było tanie jeśli coś się posypie.

## Kadencja zatrzymań

- Po każdym **Tier 3** — stop, zgłoś, czekaj na potwierdzenie jak w P5
- Po każdych **5 plikach Tier 1/2 razem** — krótkie podsumowanie ("zrobione X, Y, Z,
  liczniki: LEGACY_FILES N→M"), potem jedź dalej bez czekania na odpowiedź, chyba że
  coś nietypowego znajdziesz
- Jeśli natrafisz na plik, który przy czytaniu okazuje się bardziej złożony niż sugeruje
  jego tier (np. 350 linii ale gęsta logika biznesowa z wieloma edge-case'ami) —
  **podnieś go do Tier 3 ręcznie**, nie kontynuuj mechanicznie

## Czego NIE robić (rzeczy które dziś poszły źle)

- Nie mieszaj tej pracy z jakąkolwiek zmianą zachowania — zero "przy okazji poprawiłem
  bug X". Jeśli zauważysz bug podczas czytania, zanotuj osobno, nie napraw w tym commicie
- Nie dotykaj `RichEditor.tsx` — na stałe wyjątek, uzasadnienie w `MIMO_P5_BRIEF.md`
- Nie dotykaj `database.types.ts` — generowany
- Nie obniżaj `maxWarnings`/innych baseline'ów "na wyrost" — obniżaj dokładnie o tyle,
  o ile realnie spadł licznik w danym commicie
- Nie zaczynaj Tier 3 bez planu tekstowego zaakceptowanego (jednym zdaniem wystarczy,
  ale musi być)

## Cel końcowy (nie liczbowy, jakościowy)

`LEGACY_FILES` prawdopodobnie nigdy nie dojdzie do 0 — niektóre pliki (jak `RichEditor.tsx`)
zostają świadomie. Sukces tej pracy to: **żaden plik na liście nie jest tam z powodu
zaniedbania, tylko ze świadomej decyzji** (jak RichEditor) — i lista realnie się kurczy
sesja po sesji, widoczne w `ratchet-baseline.json`.
