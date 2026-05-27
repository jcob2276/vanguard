# ETAP 0 – Status i Podsumowanie (Czerwiec 2026)

Cel Etapu 0: Doprowadzić fundament danych i ekstrakcji do stanu, w którym można bezpiecznie i z sensem ruszyć Etap 1 (Widoczność Wzorców + Anty-Self-Deception).

---

## Aktualny Status Etapu 0

**Ogólny postęp:** W trakcie (solidna podstawa zrobiona, kluczowe decyzje jeszcze przed nami).

### Co jest już w bardzo dobrej formie (lub gotowe):

- [x] Szczegółowe zmapowanie dualizmu `evening_extraction` vs `p2_parsed` (pola + miejsca użycia) → `ETAP_0_DUALIZM_MAPPING.md`
- [x] Rekomendacja strategii dualizmu (legacy + rozwój tylko po stronie P2) → tamże
- [x] Propozycja czystego modelu danych na kolejne lata → `ETAP_0_CZYSTY_MODEL_DANYCH.md`
- [x] Szczegółowy, realny do wdrożenia proces pomiaru jakości ekstrakcji → `ETAP_0_PROCES_POMIARU_JAKOSCI.md`
- [x] Plan wersjonowania promptów + metadane jakości → `ETAP_0_WERSJONOWANIE_I_METADANE.md`
- [x] Priorytetyzowana lista zadań na cały Etap 0 → `ETAP_0_ZADANIA.md`
- [x] Kryteria zakończenia Etapu 0 (Definition of Done) → `ETAP_0_KRYTERIA_ZAKONCZENIA.md`

### Co wymaga decyzji lub dalszej pracy:

- [ ] **Decyzja strategiczna dualizmu** – czy akceptujemy rekomendację "legacy + rozwój tylko po stronie P2"?
- [ ] **Pierwszy baseline pomiaru jakości** – wykonanie pierwszego audytu (sampling + ocena 40-60 przykładów).
- [ ] **Wdrożenie podstawowych metadanych jakości** (parser_version, last_reviewed_at itp.).
- [ ] **Wersjonowanie promptów** w kodzie (wyciągnięcie promptów + logowanie wersji).
- [ ] **Dokument "Model Danych Behawiuralnych"** – podniesienie do wersji V0.9 / V1.0 po decyzjach.

---

## Co jest potrzebne, żeby uznać Etap 0 za zamknięty

Patrz dokument: `ETAP_0_KRYTERIA_ZAKONCZENIA.md`

W skrócie – najważniejsze rzeczy:
1. Jasna decyzja co do dualizmu.
2. Działający (nawet prosty) proces regularnego pomiaru jakości.
3. Wersjonowanie promptów + podstawowe metadane jakości w bazie.
4. Dobra świadomość i udokumentowany model danych.

---

## Rekomendowana kolejność dalszych kroków (Etap 0)

1. **Decyzja dualizmu** (najpierw – blokuje wiele innych rzeczy)
2. **Wdrożenie wersjonowania + metadanych jakości** (relatywnie szybkie i niskoryzykowne)
3. **Pierwszy audyt jakości (baseline)** + uruchomienie regularnego procesu pomiaru
4. **Uporządkowanie dokumentacji modelu danych**
5. **Aktualizacja backlogu zadań** na podstawie podjętych decyzji

Po spełnieniu kryteriów z `ETAP_0_KRYTERIA_ZAKONCZENIA.md` – zielone światło na Etap 1.

---

**Status ogólny:** Jesteśmy w dobrej pozycji. Największe rzeczy do zrobienia w Etapie 0 to decyzje + wdrożenie lekkich procesów i metadanych. Nie ma tu wielkich, ryzykownych refaktoryzacji na tym etapie.

Jak chcesz, żebym dalej prowadził ten etap (np. przygotował gotowe propozycje decyzji, checklisty wdrożeniowe, albo konkretne taski do Jiry/Notion)?