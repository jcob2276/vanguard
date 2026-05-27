# ETAP 0 – Checklist Zamknięcia (Actionable)

Użyj tego dokumentu jako checklisty. Zaznaczaj, co jest zrobione.

## 1. Dualizm i Model Danych

- [ ] Podjęta decyzja strategiczna: zostawiamy `evening_extraction` jako legacy czy migrujemy szybciej?
- [ ] Zmapowane wszystkie istotne pola z `evening_extraction` + miejsca ich użycia (ETAP_0_DUALIZM_MAPPING.md)
- [ ] Zmapowane wszystkie istotne pola z `p2_parsed` + miejsca ich konsumowania
- [ ] Przygotowana propozycja czystego modelu danych na kolejne lata (ETAP_0_CZYSTY_MODEL_DANYCH.md)
- [ ] W `planningDraft` wprowadzony wyraźny podział (`operational_facts` vs `user_reflection`)

## 2. Pomiar Jakości Ekstrakcji

- [ ] Zdefiniowany proces pomiaru jakości (co mierzymy, jak często, jak oceniamy) – ETAP_0_PROCES_POMIARU_JAKOSCI.md
- [ ] Przygotowany pierwszy arkusz/formularz do oceny (nawet prosty Google Sheet)
- [ ] Wykonany co najmniej jeden pełny audyt jakości (baseline) na 40-60 przykładach
- [ ] Wprowadzone podstawowe metadane jakości (`parser_version`, `last_reviewed_at`, `extraction_quality_score` itp.)

## 3. Wersjonowanie i Standaryzacja

- [ ] Wprowadzone wersjonowanie promptów ekstrakcyjnych (auto-classify + P2)
- [ ] Logowanie wersji parsera przy każdym zapisie ekstrakcji
- [ ] Opisany proces testowania i wdrażania nowych wersji promptów (ETAP_0_WERSJONOWANIE_I_METADANE.md)

## 4. Dokumentacja

- [ ] Podstawowa wersja dokumentu "Model Danych Behawiuralnych" (nawet V0.8–V0.9)
- [ ] Zaktualizowany główny audyt Etapu 0 (ETAP_0_AUDIT.md) z rekomendacjami i statusem
- [ ] Przygotowana priorytetyzowana lista zadań na Etap 0 (ETAP_0_ZADANIA.md)
- [ ] Zdefiniowane i udokumentowane kryteria zakończenia Etapu 0 (ETAP_0_KRYTERIA_ZAKONCZENIA.md)

## 5. Decyzje i Zrozumienie

- [ ] Kluczowe decyzje (szczególnie dualizm) omówione i zaakceptowane
- [ ] Zespół rozumie, co jest legacy, a co jest nowym kierunkiem
- [ ] Backlog Etapu 0 jest aktualny po podjętych decyzjach

---

**Kiedy wszystkie powyższe punkty są zaznaczone → Etap 0 można formalnie zamknąć i wchodzić w Etap 1.**

---

**Uwaga:** Nie musisz mieć idealnego modelu danych w produkcji ani wykonanych wszystkich audytów. Wystarczy, że proces jest zdefiniowany, decyzje są podjęte, a pierwsze dane i metadane zaczynają spływać.