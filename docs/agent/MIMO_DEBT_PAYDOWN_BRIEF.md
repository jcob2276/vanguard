# Brief dla MIMO — spłata długu strukturalnego (poza design 10/10)

To jest osobny wątek od `DESIGN_SYSTEM_10_10.md` (DS0-DS6, już w toku). Ten brief dotyczy
liczników z `scripts/ops/ratchet-baseline.json` i `scripts/ops/legacy-lines-baseline.json`,
które `FRONTEND_10_10_PLAN.md` świadomie zostawił jako "maleje", bez konkretnej sesji.
"Maleje" bez przydzielonego czasu w praktyce nie maleje nigdy — to ten czas.

Stan dziś (zweryfikowany `ratchet-baseline.json`):

| Tracker | Wartość | Priorytet |
|---|---|---|
| `patternCount_fixedInset` | 21 | 1 — najniższe ryzyko, mechaniczne |
| `patternCount_sessionProp` | 44-48 | 2 — mechaniczne, jeden hook już istnieje |
| `patternCount_asAny` | 134 | 3 — wymaga myślenia, jeden plik ma 60/134 |
| `maxWarnings` | 659 | 4 — spada jako efekt uboczny punktów 1-3, nie osobna sesja |
| `LEGACY_FILES` | 118 plików | 5 — najwyższe ryzyko, splity god-files, rób ostatnie |

## Twarde zasady (te same co w DS1 brief, przypomnienie)

1. Po każdej zmianie: `npm run typecheck:ui` → `npx eslint <dotknięte pliki>` →
   `npm run test` → `npm run ratchet:frontend`, w tej kolejności, napraw zanim jedziesz dalej.
2. Po przeniesieniu/rozbiciu pliku sprawdź `eslint.config.js` (`LEGACY_FILES`,
   `NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS`) i `legacy-lines-baseline.json` — stare ścieżki
   nie śledzą się same.
3. Obniżaj baseline w `ratchet-baseline.json`/`legacy-lines-baseline.json` **w tym samym
   commicie** co fix, nigdy osobno.
4. Jedna sesja (P1, P2, P3...) = jeden commit, dopiero po zielonym pełnym zestawie.

---

## P1 — Dokończ `fixed inset-0` (21→ blisko 0)

```bash
grep -rl "fixed inset-0" src/components | grep -v "ui/Modal.tsx\|ui/ConfirmDialog.tsx"
```

Te 21 to reszta po DS1 (DS1 już zbił z 21 pierwotnych do 18, licząc od stanu sprzed DS1
— sprawdź aktualną listę powyższym grepem, bo mogła się przesunąć). Świadomie pominięte
w DS1 (WeeklyReview, MorningPlan, DailyShutdown) też tu wracają — zdecyduj per plik:
- jeśli modal ma tylko prosty header+content → migruj na `ui/Modal`
- jeśli ma custom progress bar / multi-step wizard (jak WeeklyReviewModal) → rozważ czy
  `ui/Modal` przyjmie `children` z własnym headerem (sprawdź `showCloseButton={false}` +
  własny header w content) zamiast zostawiać ręczny overlay na zawsze

**DoD:** `patternCount_fixedInset` w baseline ≤ 2 (Modal.tsx + ConfirmDialog.tsx same się liczą).

---

## P2 — `session: Session` prop-drilling (44-48 plików)

Hook już istnieje: `useUserId()` w `src/store/useStore.ts:63` — czyta `session.user.id`
bezpośrednio ze store'a, bez propa.

```bash
grep -rln "session: Session" src/components
```

Reguła z `FRONTEND_10_10_PLAN.md` S10: **tylko liście drzewa, gdzie `session` jest używany
wyłącznie po `.user.id`** (nie po `.access_token` czy innych polach). Sprawdź każdy plik:

```bash
# w danym pliku — czy session używany jest tylko jako session.user.id / session?.user?.id?
grep -n "session\." src/components/<plik>
```

Jeśli tak → zamień prop `session: Session` na wywołanie `const userId = useUserId();`
wewnątrz komponentu, usuń prop z interfejsu i z miejsc wywołania (uważaj na łańcuch —
jeśli komponent przekazuje `session` dalej w dół do dziecka, dziecko przepnij osobno,
od najgłębszego liścia w górę, żeby nie zostawić martwego propa po drodze).

Jeśli `session` jest używany też do `.access_token` (np. wywołania edge functions) —
**zostaw jak jest**, to nie jest ten przypadek, `useUserId()` nie da access tokena.

**DoD:** `patternCount_sessionProp` spada wyraźnie (nie musi do 0 — access_token-userzy
zostają), baseline obniżony o realną liczbę migrowanych plików.

---

## P3 — `as any` (134, skoncentrowane)

```bash
grep -rln "as any" src --include=*.ts --include=*.tsx | xargs -I{} sh -c 'echo "$(grep -c "as any" {}) {}"' | sort -rn
```

**Zacznij od `src/lib/stats/exportStats.ts` — 60 z 134 wystąpień w jednym pliku.**
To prawdopodobnie jeden powtarzalny wzorzec (np. rzutowanie wierszy raportu/eksportu) —
przeczytaj plik, znajdź wspólny typ do wyciągnięcia, napraw hurtem w jednej sesji zamiast
punktowo. Jeśli to faktycznie 60 różnych przypadków bez wspólnego mianownika, podziel na
mniejsze commity (np. po sekcji pliku).

Potem kolejne co do wielkości: `useDirection.ts` (10 — dotyczy `week_*` pól, `FRONTEND_10_10_PLAN.md`
S7 już to flagował: "jeśli kolumny są w DB, casty znikają za darmo po `npm run
db:update-types`" — spróbuj najpierw regenerację typów przed ręcznym typowaniem),
`offlineQueue.ts` (4), `foodLogging.ts`/`aiContext.ts`/`LifeGoalsCard.tsx`/`usePowerListData.ts` (3 każdy).

Wzorce do typowania (z dzisiejszej sesji, sprawdzone bezpieczne):
- `catch (e: any)` → `catch (e: unknown)`, potem `e instanceof Error ? e.message : '...'`
- `(x as any).pole` po `if (x.type === 'wariant')` → zwykle niepotrzebne, TS narrowing
  już działa, po prostu usuń cast
- `Promise<any>` w sygnaturze callbacku → `Promise<unknown>`
- Gdy prawdziwy typ istnieje gdzieś indziej (funkcja API, DB row) — importuj i użyj go,
  nie zgaduj nowego typu

**DoD:** `patternCount_asAny` ≤ 40 po tej sesji (agresywny, ale `exportStats.ts` sam
daje -60 jeśli się uda).

---

## P4 — `maxWarnings` (659)

Nie osobna sesja — sprawdź po P1-P3: `npm run lint` pokazuje aktualną liczbę warningów
na końcu (`✖ N problems (0 errors, N warnings)`). Jeśli spadła poniżej 659 — obniż
`maxWarnings` w `package.json` w tym samym commicie co ostatnia sesja P1-P3, która to
spowodowała. Nie osobno.

---

## P5 — `LEGACY_FILES` (118 plików, rób OSTATNIE, najwyższe ryzyko)

Top 5 wg linii (bez `database.types.ts` — generowany, nie dotykaj):

```
889  src/components/lifestyle/LinksInbox.tsx
869  src/components/todo/TodoCard.tsx
855  src/components/notes/RichEditor.tsx
834  src/components/calendar/CalendarGrid.tsx
829  src/components/core/MorningPlanModal.tsx
```

To wymaga Wzorca A z `FRONTEND_10_10_PLAN.md` (Container/View split), nie mechanicznego
grepa. **Nie rób tego bez wcześniejszej rozmowy** — każdy z tych plików to realny,
złożony feature (np. `TodoCard.tsx` renderuje kartę zadania z podzadaniami, drag&drop,
kontekst menu — rozbicie źle zrobione = realna regresja funkcjonalna, nie tylko lint).

Jeśli mimo to chcesz zacząć: wybierz JEDEN plik, przeczytaj go w całości, zaproponuj
podział (jakie sub-komponenty, jaki hook) **jako plan tekstowy przed edycją**, dopiero
po akceptacji rozbijaj. Jeden plik = jedna sesja = jeden commit, zweryfikowany wizualnie
w przeglądarce (nie tylko typecheck — te pliki mają złożony UI stan).

**DoD:** żaden konkretny cel liczbowy — to wieloletnia praca. Sukces = jeden plik mniej
w `LEGACY_FILES`, zero regresji wizualnej, potwierdzone screenshotem przed/po.

---

## Kolejność

P1 → P2 → P3 → P4 (przy okazji) → **stop, czekaj na sygnał przed P5**. P5 ma inny profil
ryzyka niż reszta (funkcjonalna regresja, nie tylko lint) i wymaga osobnej rozmowy o
podziale konkretnego pliku przed dotknięciem kodu.
