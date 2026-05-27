# ETAP 1 – Pierwsze interfejsy pokazywania wzorców (propozycje konkretne)

**Data:** czerwiec 2026  
**Zasada przewodnia:** Najpierw tekstowe iniekcje w miejscach, gdzie użytkownik już jest i już myśli o sobie. Zero nowych ekranów i ciężkich dashboardów na start. Język wyłącznie dowodowy ("u Ciebie", "w Twoich danych z ostatnich X dni", "N=...", nigdy "musisz" / "wiesz co powinieneś").

---

## 1. Pattern Card – format wielokrotnego użytku (mały, ale sztywny)

Każdy surfaced wzorzec powinien mieć mniej więcej tę strukturę (dostosowaną do miejsca):

```
[EMOJI] Wzorzec u Ciebie (N=14, ostatnie 6 tygodni)

Kiedy [warunek z danych] → w [X]% przypadków [konsekwencja z danych]

Ostatni raz widziałem to [data]. Najsilniejszy przykład: [krótki cytat lub data]

[opcjonalnie] Twoja wczorajsza refleksja pasuje do tego schematu.
```

**Zasady języka:**
- Zawsze podawaj N i horyzont czasowy.
- Zawsze rozróżniaj operational_facts vs user_reflection jeśli mieszamy.
- Zawsze daj przyciski feedbacku (nawet jeśli 2-3 opcje).
- Nigdy nie sugeruj akcji w pierwszej wersji.

---

## 2. Miejsce #1: Bridge message po wieczornym reconciliation (najwyższy priorytet)

**Dlaczego tutaj:** Użytkownik właśnie opowiedział wieczór własnymi słowami (p2_parsed). Ma najwyższą gotowość emocjonalną do zobaczenia rozjazdu lub powtarzalności.

**Co pokazywać (Faza 1.1):**

- Jeśli w p2_parsed.blocker_candidates pojawił się blocker, który system widzi jako powtarzający się (S1 z researchu) → krótka linijka na końcu bridge'a.
- Jeśli wczorajszy plan (planning_summary) miał wyraźny rozjazd z rzeczywistością (S4) → jedna zdanie + link do "pokaż szczegóły" (albo po prostu tekst).

**Przykład tekstu (po sekcji "Twoja refleksja"):**

```
---

W Twoich danych ten schemat powtarza się:

Kiedy nazywasz "strach przed zimnym telefonem" jako blocker (jak dziś), 
to w 9 na 13 przypadków w ciągu 4-5 dni pojawia się friction typu communication_drift lub procrastination (N=13, ostatnie 7 tygodni).

Ostatni raz widziałem to dokładnie 11 dni temu.
```

**Przyciski pod tym (zawsze):**
```
[ To ma sens ]  [ To nie jest mój schemat ]  [ Obserwuj, nie pokazuj ]
```

**Implementacja:** W reconciliation.ts, po zbudowaniu bridgeText, doklejasz sekcję jeśli detektor zwrócił wynik powyżej progu.

**Dualizm:** Jeśli używasz p2_parsed.blocker + friction → wyraźnie: "Kiedy nazywasz X jako blocker" (to Twoje słowa) → "pojawia się friction" (to dane z auto-classify).

---

## 3. Miejsce #2: Morning brief (codzienna dawka)

**Dlaczego tutaj:** Użytkownik otwiera dzień. Najlepszy moment na "pamiętaj o tym schemacie, bo dziś możesz w niego wejść".

**Wersja bardzo lekka (Faza 1.1):**

Tylko 1-2 najsilniejsze wzorce (lub żaden, jeśli nic nie przekracza progu).

**Przykład tekstu (wstawiany po "Pierwszy blok", przed "Artefakt"):**

```
W Twoich danych z ostatnich 5 tygodni:

Po przerwaniu first_90 telefonem następnego dnia średnio masz o 0.27 niższy execution_score niż Twój własny baseline (N=11).

Dziś rano — pilnuj pierwszego ruchu.
```

Lub krócej (jeśli miejsce jest ciasne):

```
Schemat z Twoich danych: phone_first rano → niższa egzekucja następnego dnia (N=11).
```

**Kiedy nie pokazywać:** Gdy p2_parsed z wczoraj ma bardzo niską pewność lub gdy to samo było pokazane 2 dni wcześniej (unikanie irytacji).

**Przyciski:** Tylko jeden cichy: `[ Nie pokazuj tego schematu rano ]` (wyciszenie na 14 dni dla tego wzorca).

---

## 4. Miejsce #3: Oracle – kontekst przy pytaniach o siebie

**Kiedy aktywować:** Gdy classifyIntentSafe zwraca 'recent_pattern', 'biometric' lub broad self-reference + pytanie zawiera słowa typu "dlaczego", "ostatnio", "znowu", "zawsze", "co się dzieje".

**Dodatkowy blok w promptcie Oracla (już częściowo zrobione dla p2, trzeba rozszerzyć):**

```
[POWTARZALNE WZORCE UŻYTKOWNIKA — TYLKO DOWODY, BEZ INTERPRETACJI]
- [Wzorzec S1]: ...
- [Wzorzec S2]: ...
Używaj wyłącznie jako kontekst faktograficzny. Jeśli użytkownik pyta o przyczyny — podawaj tylko korelacje z danymi + cytaty z jego własnych p2_parsed. Nigdy nie diagnozuj.
```

**W odpowiedzi Oracla** (instrukcja dla modelu):
- Zawsze cytuj konkretne N i siłę.
- Zawsze rozróżniaj "użytkownik sam nazwał wieczorem" vs "dane pokazały".
- Jeśli nie ma silnych wzorców — w ogóle nie wspominaj (lepiej cisza niż słaby sygnał).

---

## 5. Miejsce #4: Weekly synthesis (ewolucja istniejącego)

Obecna weekly-synthesis już robi agregacje friction + biometrics.

**Propozycja dodania (Faza 1.1 lub 1.2):**

Nowa sekcja na końcu:

```
NAJSILNIEJSZE POWTARZALNE WZORCE TEGO TYGODNIA (z ostatnich 60 dni)

1. [S3] Po snach poniżej 6.2h → 2.3× więcej friction:procrastination następnego dnia (N=8 w tym tygodniu, N=19 ogółem)
2. [S4] W 4 z 5 planów, w których zdefiniowałeś konkretny artifact + tension, następnego dnia pojawił się reality inconsistency.

Chcesz zobaczyć szczegóły któregoś?
```

+ przyciski `[ Szczegóły wzorca 1 ]` `[ Szczegóły wzorca 2 ]` `[ Nie pokazuj mi tego typu podsumowań ]`

To jest naturalne miejsce na "raport anty-self-deception za tydzień".

---

## 6. Miejsce #5: Planning session (subtelnie, jako kontekst)

W `planning.ts` (handler) — w system promptcie już jest instrukcja traktowania user_named_blockers jako hipotez użytkownika.

**Rozszerzenie (Faza 1.1):**

Dodaj blok:

```
[POWTARZALNE WZORCE — UŻYWAJ TYLKO JAKO OSTRZEŻENIE PRZED SAMOOSZUKIWANIEM]
Na podstawie danych użytkownika z ostatnich tygodni, gdy planował podobne rzeczy w podobnym stanie (phone_first + te same blokery), jego rzeczywista egzekucja była średnio o 31% niższa niż deklarowana w planie (N=9).
Nie mów mu "nie rób tego". Po prostu pamiętaj o tym fakcie przy ocenie, czy ten plan jest realistyczny.
```

W odpowiedzi planistycznej Oracla/LLM: jeśli wzorzec jest silny — jedna krótka, sucha linijka w planie, np. w sekcji "biggest_risk" lub jako osobna notatka "Historycznie przy tym schemacie...".

---

## 7. Mechanizmy feedbacku użytkownika (KLUCZOWE dla Etapu 1)

Bez tego wszystko umrze.

**Minimalny zestaw przycisków na każdy surfaced pattern:**

1. `[ To ma sens / potwierdzam ]` → podnosi status wzorca do 'user_confirmed', zwiększa wagę
2. `[ To nie jest prawda / nie mój schemat ]` → podnosi do 'user_rejected' lub obniża confidence + zapisuje powód (opcjonalny tekst)
3. `[ Obserwuj, ale nie pokazuj przez 14 dni ]` → tymczasowe wyciszenie dla tego wzorca

**Gdzie logować:** Nowa tabela `vanguard_pattern_feedback` lub po prostu w `vanguard_behavioral_patterns.user_notes` + kolumna `user_feedback_count`.

To jest dane treningowe dla przyszłych lepszych detektorów.

---

## 8. Nowe, minimalne wejście (opcjonalne w Faza 1.1)

Opcja A (najłatwiejsza):
- Komenda `/wzorce` lub przycisk w menu "Wgląd w moje schematy" → wysyła 3-5 najsilniejszych aktualnych wzorców (jako długa wiadomość).

Opcja B:
- W weekly synthesis dodać stały przycisk "Pokaż wszystkie moje powtarzalne wzorce".

Nie rób dedykowanego flow na początek. Najpierw niech wzorce "wyciekają" w naturalnych miejscach.

---

## 9. Priorytety wdrożenia interfejsów (Faza 1.1)

1. **Bridge reconciliation** (S1 + S4) — największa wartość + najwyższa gotowość użytkownika
2. **Morning brief** (S2) — codzienna, akcyjna dawka
3. **Oracle context injection** (wszystkie 4) — kiedy użytkownik sam pyta o siebie
4. **Weekly synthesis** — raportowy, refleksyjny
5. **Planning context** — defensywny (ochrona przed samooszukiwaniem przy planowaniu)

---

## 10. Co NIE robić w pierwszych interfejsach

- Nie rób pięknych kart / wykresów / dashboardu w UI.
- Nie pokazuj więcej niż 2 wzorce naraz w jednym miejscu (przeładowanie).
- Nie używaj języka "wykryłem u Ciebie schemat X" — tylko "w Twoich danych ten schemat się powtarza".
- Nie próbuj "przekonywać" użytkownika. Tylko pokazuj dowód + daj mu przycisk "to bzdura".
- Nie mieszaj wzorców z poradami ("dlatego powinieneś...").

---

**Podsumowanie dla implementacji:**

Najpierw zaimplementuj **Pattern Card** jako małą funkcję pomocniczą.

Potem doklejaj go w 4 miejscach w kolejności: reconciliation.ts → morning-brief → oracle prompt → weekly-synthesis.

Feedback buttons to nie "nice to have" — to jest warunek przetrwania Etapu 1. Bez nich będziesz generował szum, którego użytkownik nie będzie mógł korygować.

To jest dokładnie ten moment, w którym Vanguard zaczyna być czymś więcej niż "system, który zbiera dane". Zaczyna być systemem, który **oddaje dane użytkownikowi w formie, w której może je zobaczyć bez samooszukiwania**.

---

*Ten dokument jest bezpośrednim inputem do implementacji Faza 1.1 interfejsów. Po researchu wzorców (ETAP_1_RESEARCH_...) i pogłębionym backlogu.*