# Polish 10/10 — plan domknięcia (backend krytyczne + spłata długu strukturalnego)

> Trzeci plan w rodzinie "10/10". Nie duplikuje pozostałych dwóch — wskazuje je i dodaje to,
> czego żaden z nich nie pokrywa: krytyczne dziury backendu + **realną**, sesyjną spłatę
> liczników, które `FRONTEND_10_10_PLAN.md` świadomie zostawił jako "maleje" bez planu jak.
>
> Powiązane: [DESIGN_SYSTEM_10_10.md](DESIGN_SYSTEM_10_10.md) (wygląd/UX, w toku: DS1-DS6,
> patrz [MIMO_DS1_BRIEF.md](agent/MIMO_DS1_BRIEF.md)), [FRONTEND_10_10_PLAN.md](FRONTEND_10_10_PLAN.md)
> (architektura/CI, S0-S14 **zamknięte** commitem `903a4a8d`), [lessons.md](../lessons.md).

---

## Dlaczego ten plik istnieje

Trzy różne "10/10" w repo mierzą trzy różne rzeczy:

| Plan | Mierzy | Status | Ma finisz? |
|---|---|---|---|
| `DESIGN_SYSTEM_10_10.md` | Wygląd, UX, dark mode, responsive | DS0 done, DS1-DS6 w toku (MIMO) | Tak — grep'y dochodzą do 0 |
| `FRONTEND_10_10_PLAN.md` | Architektura, CI, bezpieczeństwo frontu | **Zamknięty** (S0-S14) | Tak, wg własnej rubryki |
| **Ten plik** | Backend krytyczne + liczniki które FRONTEND_10_10_PLAN świadomie zostawił jako "maleje" (as any, god-files, maxWarnings) | Nowy | **Nie** — z definicji proces ciągły, ten plik tylko daje mu tempo i commitowalne kroki |

`FRONTEND_10_10_PLAN.md` explicit: *"Czego NIE robimy: hurtowe refaktory god-files poza
ratchetem"*. To była słuszna decyzja na etap S0-S14 (odblokować CI, nie ryzykować regresji
podczas dużej reorganizacji). Ale "maleje" bez sesji i bez targetu = w praktyni nie maleje
nigdy — nikt nie bierze się za coś bez przydzielonego czasu. Ten plik to naprawia.

---

## Kolejność globalna

1. **P0 — Backend krytyczne** (blokery, rób pierwsze, ~2-3h łącznie)
2. **DS1-DS6** — równolegle, prowadzi MIMO wg `MIMO_DS1_BRIEF.md`, ty robisz review po commicie
3. **PD1-PD6** — spłata długu strukturalnego, ten dokument, może iść równolegle z DS o ile
   nie dotyka tych samych plików (sprawdź nakładanie: DS1 rusza `fixed inset-0` w tych samych
   19-21 plikach co PD3 niżej — **rób DS1 przed PD3**, nie równolegle)

---

## P0 — Backend krytyczne

Zweryfikowane bezpośrednio w kodzie 2026-07-11 — wszystkie trzy wciąż otwarte.

### P0.1 — Nightly gubi wzorce co noc (~30 min)

`supabase/functions/_shared/nightly/patterns.ts:47` zwraca `status: "hypothesis"` dla
niskopewnościowych wzorców. CHECK constraint na `vanguard_behavioral_patterns.status`
dopuszcza tylko `pending/visible/user_confirmed/user_rejected/snoozed/archived` — insert
cicho pada (`upsertPattern()` robi `console.error` i mimo to zwraca sukces).

- [ ] Zmień `"hypothesis"` → `"pending"` w `patterns.ts:47`
- [ ] Sprawdź pozostałe miejsca w tym samym module z tym literałem (grep `hypothesis` w
      `supabase/functions/_shared/nightly/`)
- [ ] Deploy + weryfikacja: `SELECT count(*) FROM vanguard_behavioral_patterns WHERE status = 'pending'`
      przed i po następnym cronie (20:00 UTC) — licznik musi rosnąć, nie JSON response funkcji

**DoD:** insert nie pada na CHECK constraint; potwierdzone przez `SELECT`, nie przez response funkcji.

### P0.2 — Brak walidacji tokenu na `verify_jwt=false` endpointach (~1h)

`vanguard-nightly` i `vanguard-telegram-worker` mają `verify_jwt=false` i zero weryfikacji
`Authorization` w kodzie (zweryfikowane grepem — brak dopasowań). Każdy z internetu może je
wywołać. Wzorzec poprawnej walidacji już istnieje w `vanguard-backtester`.

- [ ] Skopiuj wzorzec walidacji tokenu z `supabase/functions/vanguard-backtester/index.ts`
      do `vanguard-nightly/index.ts` i `vanguard-telegram-worker/index.ts`
- [ ] Sprawdź `cron.job.command` — jeśli service-role secret leży plaintextem, przenieś do
      Supabase Vault (`vault.create_secret` + `vault.decrypted_secrets` w komendzie crona)
- [ ] `get_advisors` (Supabase MCP) po zmianie — potwierdź że SECURITY DEFINER RPC
      (`get_desktop_dashboard_data` i inne wykonywalne przez `anon`) są też objęte przeglądem

**DoD:** żądanie bez poprawnego tokenu → 401; `get_advisors` nie pokazuje tego findingu.

### P0.3 — Cotygodniowy `vanguard_graph_cleanup()` niszczy claims (~1-2h)

Trigger `tr_sync_entity_links_to_claims` przy DELETE z merge encji kasuje claims — sprzeczne
z warstwą bi-temporalną. `merged_into` (nowszy mechanizm) ma 0 użyć — stary trigram-merge
nigdy nie został wyłączony.

- [ ] Przeczytaj `vanguard_graph_cleanup()` (SQL) i `tr_sync_entity_links_to_claims`
- [ ] Zdecyduj: wyłącz stary trigram-merge na rzecz `merged_into`, albo zmień DELETE na
      soft-delete/re-parenting zamiast kaskadowego kasowania claims
- [ ] Backfill `entity_aliases` jeśli `merged_into` ma to zastąpić (dziś 0 aliasów)

**DoD:** `vanguard_graph_cleanup()` nie kasuje wierszy z `claims` powiązanych z merge'owaną encją.

### P0.4 — Weryfikacja Fazy 4 (predykcje/rekomendacje) (~15 min)

Nightly działa od kilku dni — sprawdź czy faktycznie zapisuje.

- [ ] `SELECT count(*) FROM vanguard_predictions`, `oracle_recommendations`, `vanguard_pipeline_runs`
      — jeśli 0, debug przed zamknięciem tematu

**DoD:** liczniki >0 lub zdiagnozowana przyczyna dlaczego nie.

---

## PD — Polish Debt: spłata liczników strukturalnych

Zasada: **jedna sesja = jedna kategoria = jeden commit**, pełny zielony zestaw przed
commitem (`npm run typecheck:ui && npx eslint <dotknięte> && npm run test && npm run ratchet:frontend`),
baseline w `scripts/ops/ratchet-baseline.json` / `legacy-lines-baseline.json` **obniżony w
tym samym commicie**. Nie zgaduj targetu — po każdej sesji zmierz i wpisz realną liczbę.

### PD1 — `as any`: top 5 offenderów (~2h)

Stan na 2026-07-11 (134 wystąpień w repo, top offenderzy):

| Plik | Ile `as any` |
|---|---|
| `src/lib/stats/exportStats.ts` | 60 |
| `src/components/lifestyle/direction/hooks/useDirection.ts` | 10 |
| `src/lib/offlineQueue.ts` | 4 |
| `src/lib/health/foodLogging.ts` | 3 |
| `src/lib/aiContext.ts` | 3 |
| `src/components/projects/LifeGoalsCard.tsx` | 3 |
| `src/components/lifestyle/usePowerListData.ts` | 3 |

- [ ] `exportStats.ts` (60 — sam ten plik to 45% całego długu `as any` w repo): sprawdź czy
      to jeden powtarzalny wzorzec (np. `row as any` w mapowaniu eksportu CSV/PDF) —
      jeśli tak, jeden typed helper/generic zamiast 60 castów osobno
- [ ] Reszta top 5: doprecyzuj typ lub `unknown` + type-guard (zasada #5 konstytucji —
      zero `as any`, nie "mniej `as any`")
- [ ] Jeśli powodem castów jest `database.types.ts` nieaktualny wobec realnego schematu —
      najpierw `npm run db:update-types`, dopiero potem doprecyzowanie w TS (lekcja z
      `lessons.md` 2026-07-08: "po migracji dodającej tabelę zrób update-types przed DAL")

**Target tej sesji:** `as any` 134 → ≤65 (zejście o `exportStats.ts` + top 4 reszty).
Obniż `patternCount_asAny` w `ratchet-baseline.json` do realnej liczby po zejściu.

### PD2 — `as any`: reszta (~2h)

- [ ] Pozostałe pliki z 1-2 wystąpieniami (grep `\bas\s\+any\b` src -rn po PD1 da aktualną listę)
- [ ] Priorytet: pliki dotykane i tak w innych sesjach (np. `useDirection.ts` też jest w
      PD4 niżej — rób `as any` przy okazji tego samego dotknięcia, nie osobno)

**Target:** `as any` → 0. `patternCount_asAny` w baseline = 0.

### PD3 — `fixed inset-0`: zostałe po DS1 (~1h)

DS1 (brief MIMO) już rusza te same 19-21 plików pod kątem migracji na `ui/Modal`. **Nie rób
tej sesji równolegle z DS1** — poczekaj aż DS1 wyląduje, potem sprawdź:

- [ ] `grep -rl "fixed inset-0" src/components | grep -v "ui/Modal.tsx\|ui/ConfirmDialog.tsx"`
      — powinno być 0-1 (ToastHost jeśli świadomie zostaje)
- [ ] Jeśli coś zostało pominięte przez DS1 (np. plik dodany po napisaniu brief'u) — domknij

**Target:** `patternCount_fixedInset` w baseline = 0 lub 1 (ToastHost).

### PD4 — God-files: pierwsza fala (Wzorzec A split) (~1 dzień, wysokie ryzyko — jeden plik na sesję)

`FRONTEND_10_10_PLAN.md` ma gotowy wzorzec (Container/View/hooks/subcomponents, sekcja
"Wzorzec A"). Świadomie NIE rób tego hurtowo — jeden plik, pełna weryfikacja wizualna,
osobny commit. Zacznij od plików bez `database.types.ts` (generowany, nie dotykaj):

| Plik | Linie | Uwaga |
|---|---|---|
| `src/components/lifestyle/LinksInbox.tsx` | 889 | najgorszy realny plik w repo |
| `src/components/todo/TodoCard.tsx` | 869 | dotykany często — wysoka wartość splitu |
| `src/components/notes/RichEditor.tsx` | 855 | WYSIWYG, wysokie ryzyko regresji — test manualny obowiązkowy |
| `src/components/calendar/CalendarGrid.tsx` | 834 | drag&drop logic — test manualny obowiązkowy |
| `src/components/core/MorningPlanModal.tsx` | 828 | |

- [ ] Dla każdego pliku: przeczytaj cały plik przed splitem (nie zgaduj granic), wydziel
      `Container` (dane/stan) vs `View` (JSX), hooks do `hooks/`, powtarzalne bloki JSX do
      `subcomponents/`
- [ ] Po każdym pliku: `npm run typecheck:ui`, `npm run test`, ręczna weryfikacja w
      przeglądarce (ekran, którego dotyczy plik) — screenshot przed/po
- [ ] Obniż limit w `legacy-lines-baseline.json` do nowej (mniejszej) liczby linii
      **pliku głównego** po splicie; nowe pliki (`Container`/`View`/hooks) nie wchodzą do
      `LEGACY_FILES` jeśli mieszczą się pod ogólnym limitem lintera (300 linii)

**Target tej sesji:** 5 plików rozbitych, każdy z osobnym commitem. `LEGACY_FILES` w
`ratchet-baseline.json`: 118 → 113 (jeśli plik główny po splicie mieści się <300 linii,
znika z listy całkowicie zamiast tylko zmniejszać limit).

### PD5 — God-files: druga fala (~1 dzień, jeśli PD4 wypadło dobrze)

Kolejna piątka wg tej samej metody: `exportStats.ts` (825, ale zobacz PD1 — może naturalnie
zmaleje po wydzieleniu helpera), `usePowerListData.ts` (745), `ProjectCard.tsx` (613),
`GrowthView.tsx` (605), `useDirectionContext.ts` (605).

- [ ] Ta sama procedura co PD4
- [ ] `useDirectionContext.ts` już oznaczony w `FRONTEND_10_10_PLAN.md` jako "najdłuższy
      hook" — sprawdź czy da się wydzielić bez łamania `useGoalSpineInvalidation`
      (lekcja z `lessons.md` 2026-06-29: nieskończona pętla przy złych deps)

**Target:** kolejnych 5 plików, `LEGACY_FILES` dalej w dół.

### PD6 — `maxWarnings`: zejście (~2-3h, powtarzalne co sesję)

- [ ] `npx eslint . -f json > /tmp/eslint.json` (albo scratchpad), zsumuj warnings per rule
      (`ruleId`), zacznij od reguły z największą liczbą wystąpień — jeden typ błędu naraz
      jest mechaniczny i bezpieczny do naprawy hurtem
- [ ] Po każdej naprawionej regule: obniż `--max-warnings=N` w `package.json` `lint` script
      **i** `maxWarnings` w `ratchet-baseline.json` do nowej realnej liczby
- [ ] Nie rób w jednej sesji więcej niż 1-2 reguł — łatwiej review'ować i cofnąć, jeśli coś
      pójdzie źle

**Target:** 659 → do ustalenia po pierwszym uruchomieniu breakdown (brak dziś danych o
rozkładzie reguł). Minimum: -100/sesję.

---

## Mechanizm egzekwujący (zgodnie z zasadą nadrzędną obu pozostałych planów)

Każdy punkt PD ma już gotowy mechanizm — nie trzeba nowego:

- `as any`, `fixed inset-0` → `patternCount_*` w `scripts/ops/check-frontend-ratchets.mjs`,
  fail gdy rośnie
- God-files → `legacy-lines-baseline.json`, fail gdy plik rośnie ponad zapisany limit
- `maxWarnings` → czytany wprost ze skryptu `lint` w `package.json`

Żadna z sesji PD nie wymaga nowego CI joba — istniejący `ratchet:frontend` (już w
`.github/workflows/ci.yml`) łapie regresję automatycznie. Zadanie tego planu to **obniżać
baseline w komicie**, nie dodawać infrastrukturę.

---

## Szacunek czasu

| Sesja | Temat | Czas | Blokuje / blokowane przez |
|---|---|---|---|
| P0.1 | nightly patterns fix | 30 min | nic — rób pierwsze |
| P0.2 | auth validation | 1h | nic |
| P0.3 | graph_cleanup fix | 1-2h | nic |
| P0.4 | weryfikacja Fazy 4 | 15 min | po P0.1 |
| PD1 | as any top 5 | 2h | nic |
| PD2 | as any reszta | 2h | po PD1 (mniej konfliktów) |
| PD3 | fixed inset-0 domknięcie | 1h | **po DS1** (MIMO) |
| PD4 | god-files fala 1 | ~1 dzień | nic, ale nie równolegle z DS4 (te same ekrany) |
| PD5 | god-files fala 2 | ~1 dzień | po PD4 |
| PD6 | maxWarnings zejście | 2-3h × kilka sesji | nic |

P0 zrób w tym tygodniu. PD to praca na sierpień/wrzesień — zgodnie z notatką, że po 1.08
dev spada do ~3-4h/tydz, więc rozłóż PD4/PD5 (najbardziej czasochłonne) na kilka tygodni,
jeden plik na sesję, nie próbuj hurtem.
