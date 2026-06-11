# ETAP 0 – Kryteria Zakończenia (Definition of Done)

Cel tego dokumentu: Jasno określić, co musi być spełnione, żeby uznać Etap 0 za zamknięty i bezpiecznie przejść do Etapu 1 (Widoczność Wzorców + Anty-Self-Deception).

## Minimalne kryteria (MUST HAVE) – bez tego nie ruszamy Etapu 1

### 1. Dualizm i Model Danych
- [ ] Podjęta wyraźna decyzja strategiczna co do dualizmu `evening_extraction` vs `p2_parsed` (dokumentacja decyzji w ETAP_0_DUALIZM_MAPPING.md lub w głównym audycie).
- [ ] Zmapowane wszystkie istotne pola z obu parserów + miejsca ich użycia.
- [ ] Przygotowana propozycja czystego modelu danych (nawet jeśli nie w pełni zaimplementowana) – patrz ETAP_0_CZYSTY_MODEL_DANYCH.md.
- [ ] Wprowadzony wyraźny podział w `planningDraft` (`operational_facts` vs `user_reflection`).

### 2. Pomiar Jakości Ekstrakcji
- [ ] Zdefiniowany i opisany proces pomiaru jakości (co mierzymy, jak często, jak oceniamy) – patrz ETAP_0_PROCES_POMIARU_JAKOSCI.md.
- [ ] Przygotowany pierwszy arkusz / narzędzie do ręcznej oceny (nawet jeśli proste Google Sheets).
- [ ] Wykonany co najmniej jeden pełny audyt jakości (baseline) na 40-60 przykładach.
- [ ] Wprowadzone podstawowe metadane jakości (`parser_version`, `last_reviewed_at` itp. w kluczowych tabelach).

### 3. Wersjonowanie i Standaryzacja
- [ ] Wprowadzone wersjonowanie promptów ekstrakcyjnych (auto-classify + P2).
- [ ] Logowanie wersji parsera przy zapisie ekstrakcji (w `friction_events` i `daily_reconciliations`).
- [ ] Opisany proces wprowadzania i testowania nowych wersji promptów.

### 4. Dokumentacja
- [ ] Podstawowa wersja dokumentu "Model Danych Behawiuralnych" (nawet V0.8–V0.9).
- [ ] Zaktualizowany główny audyt Etapu 0 (ETAP_0_AUDIT.md) z rekomendacjami i statusem.

## Mocne rekomendacje (SHOULD HAVE) – bardzo mocno zalecane

- [ ] Przygotowana konkretna lista zadań/ticketów na Etap 0 z priorytetami (patrz ETAP_0_ZADANIA.md).
- [ ] Zdefiniowane kryteria "Definition of Done" dla Etapu 0 (ten dokument).
- [ ] Omówione i zaakceptowane kluczowe decyzje (szczególnie dualizm) przez właściciela systemu.

## Co NIE jest wymagane do zakończenia Etapu 0

- Pełna migracja pól operacyjnych z `evening_extraction` do P2 (to może być część Etapu 1 lub osobny projekt).
- Zaawansowany, zautomatyzowany system pomiaru jakości (prosty ręczny proces w zupełności wystarczy na start).
- Idealnie czysty model danych w produkcji (wystarczy dobra propozycja + pierwsze porządki).
- Pełna dokumentacja wszystkich tabel i relacji (V1.0 dokumentu modelu danych może powstać później).

## Sygnał "Można ruszać Etap 1"

Etap 1 można bezpiecznie zacząć, gdy spełnione są wszystkie punkty z sekcji **Minimalne kryteria (MUST HAVE)**.

Najważniejsze jest to, żeby mieć:
1. Jasną decyzję co do dualizmu.
2. Działający (nawet prosty) proces pomiaru jakości.
3. Wersjonowanie promptów + podstawowe metadane.
4. Dobrą świadomość aktualnego stanu modelu danych.

---

**Status tego dokumentu:** Wersja robocza. Po podjęciu kluczowych decyzji (szczególnie dualizmu) warto go zaktualizować do wersji ostatecznej na zakończenie Etapu 0.