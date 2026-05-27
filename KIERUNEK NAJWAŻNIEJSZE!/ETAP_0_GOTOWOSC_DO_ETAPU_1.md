# ETAP 0 – Gotowość do rozpoczęcia Etapu 1

Cel tego dokumentu: Dać jasny obraz, co jest już zrobione na tyle dokładnie, że można bezpiecznie ruszać Etap 1 (Widoczność Wzorców + Anty-Self-Deception), a co jeszcze trzeba domknąć.

---

## Stan na teraz (Czerwiec 2026)

### Co jest zrobione na wysokim poziomie jakości:

- [x] Szczegółowe zmapowanie dualizmu (`evening_extraction` vs `p2_parsed`) – pola + miejsca użycia (ETAP_0_DUALIZM_MAPPING.md)
- [x] Wyraźna rekomendacja strategii dualizmu + ryzyka obu opcji
- [x] Propozycja czystego modelu danych behawiuralnych na kolejne lata (ETAP_0_CZYSTY_MODEL_DANYCH.md)
- [x] Gotowy, realny do wdrożenia proces pomiaru jakości ekstrakcji (ETAP_0_PROCES_POMIARU_JAKOSCI.md)
- [x] Plan wersjonowania promptów + metadane jakości (ETAP_0_WERSJONOWANIE_I_METADANE.md)
- [x] Priorytetyzowana lista zadań na cały Etap 0 (ETAP_0_ZADANIA.md)
- [x] Jasne kryteria zakończenia Etapu 0 (ETAP_0_KRYTERIA_ZAKONCZENIA.md)
- [x] Bieżący status + rekomendowana kolejność dalszych kroków (ETAP_0_STATUS.md)

### Co wymaga decyzji lub wykonania, zanim ruszymy Etap 1 (kluczowe rzeczy):

1. **Decyzja strategiczna dualizmu** (największy blocker)
   - Czy akceptujemy rekomendację "zostawiamy evening_extraction jako legacy i cały nowy rozwój idziemy przez P2 / user_reflection"?

2. **Uruchomienie wersjonowania promptów + metadanych jakości**
   - Dodanie kolumn `parser_version` itp.
   - Logowanie wersji przy ekstrakcji.

3. **Pierwszy audyt jakości (baseline)**
   - Wykonanie pierwszego pomiaru na 40-60 przykładach (nawet jeśli prosty ręczny).

4. **Podstawowa dokumentacja modelu danych**
   - Podniesienie propozycji modelu danych do wersji co najmniej V0.8–V0.9.

---

## Ocena gotowości

**Obecny stan:** ~70-75% Etapu 0

**Co wystarczy, żeby uznać Etap 0 za zamknięty i ruszyć Etap 1:**

- Podjęta decyzja co do dualizmu
- Wdrożone wersjonowanie + podstawowe metadane jakości
- Uruchomiony (nawet prosty) proces pomiaru jakości
- Udokumentowany kierunek modelu danych

Nie trzeba mieć idealnego modelu danych w produkcji ani wykonanych wszystkich audytów – wystarczy, że proces jest zdefiniowany i pierwsze dane będą spływać.

---

## Rekomendowana kolejność zamknięcia Etapu 0 (najbliższe tygodnie)

1. Decyzja dualizmu (1-2 dni)
2. Wdrożenie wersjonowania + metadanych (1-2 tygodnie)
3. Pierwszy audyt jakości + uruchomienie regularnego procesu (2-3 tygodnie)
4. Finalizacja dokumentacji modelu danych + aktualizacja backlogu

Po tych czterech rzeczach Etap 0 można formalnie zamknąć i wchodzić w Etap 1.

---

**Status:** Dokument gotowy. Po podjęciu decyzji co do dualizmu można go zaktualizować do wersji "Etap 0 – Zamknięcie".