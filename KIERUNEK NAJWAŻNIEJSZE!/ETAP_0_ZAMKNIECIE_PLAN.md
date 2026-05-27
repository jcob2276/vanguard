# ETAP 0 – Plan Zamknięcia (Wersja „Zróbmy to porządnie”)

**Data:** Czerwiec 2026  
**Strategia:** Legacy + New Path (zaakceptowana)  
**Podejście:** Solidne domknięcie Etapu 0 przed wejściem w Etap 1

---

## Cel tego planu

Domknąć Etap 0 na takim poziomie, żeby:
- Mieliśmy realne dane o jakości ekstrakcji
- Mieliśmy jasny, udokumentowany model danych
- Mogliśmy z czystym sumieniem powiedzieć „fundament jest wystarczająco dobry, żeby budować na nim Etap 1”

Nie gonimy perfekcji. Gonimy **dobre, świadome domknięcie**.

---

## Zakres – co musi być zrobione

### 1. Wersjonowanie promptów + metadane jakości (Must Have)

**Co dokładnie:**

- Wprowadzenie wersjonowania dla `auto-classify` i `p2-parser`
- Logowanie wersji przy każdej ekstrakcji (`parser_version`)
- Dodanie podstawowych metadanych jakości:
  - `last_reviewed_at`
  - `extraction_quality_score` (na początek ręcznie uzupełniane podczas audytów)
- Oznaczenie w kodzie części związanych z `evening_extraction` jako **legacy**

**Definicja "zrobione":**
- Wersjonowanie działa i jest zapisywane przy ekstrakcji
- Podstawowe metadane są w bazie i są aktualizowane

### 2. Pierwszy audyt jakości + uruchomienie procesu (Must Have)

**Co dokładnie:**

- Przygotowanie prostego, powtarzalnego procesu audytu jakości (co 2 tygodnie)
- Wykonanie pierwszego pełnego audytu (40-60 przykładów z ostatnich 14-21 dni)
- Zapisanie wyników jako **baseline**
- Uruchomienie regularnego procesu pomiaru jakości

**Definicja "zrobione":**
- Pierwszy audyt wykonany i wyniki udokumentowane
- Proces jest opisany i realny do powtarzania

### 3. Dokumentacja modelu danych (Should Have, mocno zalecane)

**Co dokładnie:**

- Dokument „Model Danych Behawiuralnych V0.9”
- Jasne oznaczenie:
  - Co jest legacy (`evening_extraction`)
  - Co jest primary (`p2_parsed` / `user_reflection`)
  - Sunset Criteria
  - Migration Trigger
- Krótki opis warstw danych (stream → events → states → reflection → plans)

**Definicja "zrobione":**
- Dokument istnieje w wersji co najmniej V0.8–V0.9 i jest dostępny dla zespołu

### 4. Oficjalne zamknięcie Etapu 0 (Must Have)

**Co dokładnie:**

- Sprawdzenie wszystkich punktów z checklisty zamknięcia
- Krótki status „Etap 0 – co zostało zrobione i dlaczego to wystarczy”
- Formalna decyzja o zamknięciu Etapu 0 i wejściu w Etap 1

**Definicja "zrobione":**
- Etap 0 jest oficjalnie zamknięty (nawet jeśli nie wszystko jest idealne)

---

## Proponowany harmonogram (5–7 tygodni)

| Tydzień     | Główne cele                                      | Kluczowe deliverable                              | Uwagi |
|-------------|--------------------------------------------------|----------------------------------------------------|-------|
| **1-2**     | Wersjonowanie + metadane jakości                 | Wersjonowanie działa i jest logowane              | Najmniej ryzykowny kawałek |
| **3-4**     | Pierwszy audyt jakości + proces                  | Baseline + działający proces audytu (co 2 tyg.)   | Najważniejszy sygnał jakości |
| **5-6**     | Dokumentacja modelu danych + przygotowanie zamknięcia | Model danych V0.9 + draft statusu zamknięcia     | Formalne domknięcie |
| **7**       | Zamknięcie Etapu 0 + decyzja o Etapie 1          | Oficjalne zamknięcie + zielone światło na Etap 1  | Przejście |

---

## Co świadomie odkładamy poza ten zakres

- Pełna migracja pól operacyjnych z `evening_extraction`
- Zaawansowany, zautomatyzowany system jakości
- Idealnie czysty model danych w produkcji
- Duże refaktoryzacje reconciliation handlera

Te rzeczy mogą poczekać do Etapu 1 lub później.

---

## Kluczowe decyzje w tym okresie

1. **Tydzień 1** – Ostateczna akceptacja tego planu zamknięcia
2. **Tydzień 3** – Jak mocno chcemy automatyzować proces audytu (czy na razie zostaje prosty ręczny)
3. **Tydzień 6-7** – Decyzja o dacie zamknięcia Etapu 0

---

## Podsumowanie

Ten plan jest świadomie **umiarkowany**. Nie próbujemy zrobić wszystkiego idealnie w Etapie 0. Chcemy tylko tyle, żeby Etap 1 mógł ruszyć na fundamencie, który nie będzie nas później gryzł.

Po zamknięciu tego zakresu wchodzimy w Etap 1 (Widoczność Wzorców + Anty-Self-Deception) z dużo większą pewnością, że nie budujemy na piasku.

---

**Status:** Plan gotowy do realizacji.

Chcesz, żebym teraz przygotował szczegółowy backlog zadań z tego planu (z podziałem na tygodnie i zależnościami)?