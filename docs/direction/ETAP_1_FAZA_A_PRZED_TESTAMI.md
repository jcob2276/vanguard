# Etap 1 – Faza A: Ostatnie przygotowania przed testami

**Cel fazy:**  
W ciągu 1–2 tygodni doprowadzić Etap 1 do stanu, w którym możemy odpowiedzialnie wejść w realne, dłuższe testowanie.

---

## Priorytety (kolejność proponowana)

### 1. S1 – Poprawa jakości grupowania bloków (najwyższy priorytet)

**Dlaczego to ważne:**  
S1 jest jednym z najczęstszych i najbardziej użytecznych wzorców. Obecna jakość grupowania jest "good enough", ale wciąż generuje sporo szumu.

**Zadania (małe kroki):**

- [ ] Przeanalizować 15–20 rzeczywistych blokatorów z Twojej historii (z ostatnich 2–3 miesięcy) i zidentyfikować główne tematy, które jeszcze nie są pokryte.
- [ ] Dodać 4–7 nowych tematów do `getBlockerTheme` (lub rozbudować istniejące).
- [ ] Przetestować grupowanie na tych 15–20 przykładach i sprawdzić, czy jakość się zauważalnie poprawiła.
- [ ] (Opcjonalnie) Dodać prostą ręczną listę wyjątków/synonimów dla najczęstszych przypadków.

**Cel:** Żeby większość powtarzających się blokatorów lądowała w sensownych grupach bez dużej ręcznej ingerencji.

---

### 2. Early Warning – Wzmocnienie systemu

**Dlaczego to ważne:**  
Obecnie mamy tylko 2 reżimy. Żeby Early Warning był odczuwalny i użyteczny podczas testów, warto mieć minimum 3–4.

**Zadania:**

- [ ] Zidentyfikować 1–2 dodatkowe proste reżimy, które realnie występują u Ciebie (na podstawie historii lub obserwacji).
  - Przykłady do rozważenia: wysoka fragmentacja + niski sen, powtarzające się niskie wykonanie po weekendzie, etc.
- [ ] Zaimplementować je w `detectEarlyWarningSignals`.
- [ ] Poprawić teksty komunikatów (obecne są dość ogólne – zrobić je bardziej konkretnymi i użytecznymi).
- [ ] Przetestować triggerowanie na historycznych danych.

**Cel:** Minimum 3–4 działające reżimy Early Warning przed wejściem w testy.

---

### 3. Dokumentacja testowa (bardzo ważna)

**Dlaczego to ważne:**  
Bez jasnych instrukcji testowanie będzie chaotyczne i trudno będzie wyciągać wnioski.

**Zadania:**

- [ ] Stworzyć krótki dokument: **"Jak testować Etap 1"** (1–2 strony).
  - Co dokładnie obserwować (wzorce, early warningi, szum).
  - Jak dawać feedback (kiedy warto potwierdzać/odrzucać).
  - Jak oceniać użyteczność (jakie pytania sobie zadawać).
  - Co jest sukcesem Etapu 1, a co porażką.
- [ ] Dodać do dokumentu przykłady dobrych i złych komunikatów.

**Cel:** Żebyś (lub ktoś inny) mógł testować Etap 1 w sposób świadomy i ustrukturyzowany.

---

### 4. Lekki porządek techniczny (niski priorytet, ale warto)

**Zadania (tylko jeśli zostanie czas):**

- [ ] Wyciągnąć najważniejsze stałe (progi, cooldown, minOccurrences) do jednego miejsca z komentarzami.
- [ ] Dodać krótkie JSDoc / komentarze przy kluczowych funkcjach (szczególnie detektorach i helperach).
- [ ] Ujednolicić nazewnictwo wokół early warningów (regime vs warning type).
- [ ] Sprawdzić, czy nie ma oczywistych duplikatów lub brzydkiego kodu w plikach związanych z wzorcami.

---

## Sugerowana kolejność prac (realistyczna)

1. **Tydzień 1**
   - S1 – analiza realnych blokatorów + dodanie brakujących tematów
   - Rozpoczęcie pracy nad Early Warning (nowe reżimy + teksty)

2. **Tydzień 2**
   - Dokończenie Early Warning (testy na historii)
   - Stworzenie dokumentu "Jak testować Etap 1"
   - Opcjonalnie: lekki porządek techniczny

---

## Kiedy uznajemy, że Faza A jest gotowa?

- S1 ma wyraźnie lepszą jakość niż obecnie (subiektywna ocena na podstawie Twoich danych).
- Mamy minimum 3–4 działające reżimy Early Warning.
- Istnieje dokument "Jak testować Etap 1", który daje jasne ramy.
- Czujemy, że system jest już na tyle stabilny, że warto wejść w dłuższe, świadome testowanie.

---

**Status dokumentu:** Roboczy. Będzie aktualizowany w miarę postępu Fazy A.

Ostatnia aktualizacja: czerwiec 2026
