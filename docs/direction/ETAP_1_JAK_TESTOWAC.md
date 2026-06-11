# Etap 1 – Jak testować (Przewodnik przed testami)

**Cel dokumentu:**  
Dać jasne ramy, jak świadomie i skutecznie testować Etap 1, zanim wejdziemy w dłuższy okres realnego użytkowania.

---

## 1. Co tak naprawdę testujemy w Etapie 1?

Etap 1 nie polega na tym, żeby wszystko było idealne.  
Testujemy przede wszystkim **czy system realnie zaczyna dawać wartość** w codziennym życiu.

Główne rzeczy do obserwacji:

- Czy wzorce, które pokazuje system, są **trafne** i użyteczne?
- Czy Early Warning łapie sytuacje na tyle wcześnie, że mogę coś z tym zrobić?
- Czy mam poczucie kontroli nad tym, co system mi pokazuje?
- Czy system pomaga mi zauważać rzeczy, których wcześniej nie widziałem tak wyraźnie?
- Czy poziom szumu (fałszywych pozytywów) jest akceptowalny?

---

## 2. Jak dawać feedback (bardzo ważne)

Feedback to obecnie główne źródło uczenia się systemu.

### Dobre praktyki:

- **Potwierdzaj (👍)** — kiedy wzorzec lub ostrzeżenie jest trafne i użyteczne.
- **Odrzucaj (👎)** — kiedy coś jest wyraźnie nieprawdą lub nie ma sensu.
- **Wyciszaj (⏸)** — kiedy coś jest technicznie poprawne, ale nie chcesz tego widzieć w danym momencie (np. za często).

**Zasada:**  
Im szybciej i szczerzej dajesz feedback, tym szybciej system się dostosowuje.

---

## 3. Co warto obserwować podczas testów

### Dla wzorców (Pattern Memory):

- Czy grupy blokatorów mają sens?
- Czy tytuły i opisy są czytelne?
- Czy pojawiają się wzorce, których wcześniej nie zauważałeś?
- Czy masz ochotę na nie reagować (potwierdzać/odrzucać)?

### Dla Early Warning:

- Czy ostrzeżenia przychodzą na tyle wcześnie, że jeszcze możesz zareagować?
- Czy teksty są konkretne i pomocne, czy zbyt ogólne?
- Czy nie dostajesz za dużo ostrzeżeń (spam)?
- Czy po ostrzeżeniu realnie coś się zmieniało w Twoim zachowaniu (lub nie)?

### Ogólne wrażenie:

- Czy system daje Ci poczucie, że "pamięta" Twoje zachowanie?
- Czy czujesz, że masz nad nim jakąś kontrolę?
- Czy zaczynasz naturalnie myśleć kategoriami wzorców i schematów?

---

## 4. Czerwone flagi (kiedy coś jest nie tak)

- Często mówisz „to nie ma sensu”
- Dostajesz to samo ostrzeżenie co 2-3 dni bez żadnej zmiany
- Wzorce są zbyt ogólne lub zbyt szczegółowe
- Czujesz irytację zamiast użyteczności
- Przestajesz czytać komunikaty, bo są przewidywalne i nie wnoszą nic nowego

Jeśli coś z tego się pojawia często — warto to zanotować i omówić.

---

## 5. Jak prowadzić notatki z testów (zalecane)

Najlepszy sposób na wyciągnięcie wniosków:

Zapisuj co kilka dni krótkie odpowiedzi na pytania:

1. Co system pokazał w tym tygodniu, co było trafne?
2. Co pokazał, co było nietrafne lub nieprzydatne?
3. Czy było jakieś ostrzeżenie, które realnie wpłynęło na moje zachowanie?
4. Czy pojawiło się coś, czego wcześniej nie zauważałem?
5. Co mnie irytuje lub męczy w obecnych komunikatach?

Nawet 5-7 takich notatek po 2-3 tygodnie testowania da nam bardzo dobry obraz.

---

## 6. Kiedy uznajemy, że Etap 1 ma sens?

Etap 1 uznajemy za udany (nawet jeśli nieidealny), gdy:

- Regularnie dostajesz wzorce, które uznajesz za prawdziwe i użyteczne.
- Early Warning łapie Cię w sytuacjach, w których realnie chcesz mieć wcześniejsze ostrzeżenie.
- Masz poczucie, że system pomaga Ci zauważać własne schematy.
- Poziom szumu jest akceptowalny (nie paraliżuje Cię i nie irytuje).
- Chcesz dalej z tym pracować i rozwijać (zamiast gasić).

---

## 7. Co na razie nie jest celem testowania?

- Nie oceniamy jeszcze precyzji detektorów na poziomie naukowym.
- Nie oczekujemy, że Early Warning będzie łapał wszystko.
- Nie oczekujemy pięknych interfejsów ani zaawansowanej analizy.
- Nie porównujemy okresów życia (to raczej Etap 2+).

---

**Podsumowanie:**

Testujemy przede wszystkim **czy system zaczyna realnie pomagać Ci widzieć siebie** — w sposób, który jest użyteczny i nie przytłaczający.

Im bardziej konkretny i szczery feedback dasz w pierwszych tygodniach, tym szybciej będziemy wiedzieli, co działa, a co trzeba zmienić.

---

Chcesz, żebym teraz przygotował wersję tego dokumentu bardziej zwięzłą (np. 1-stronicową checklistę do codziennego użytku podczas testów)? Albo wolisz najpierw ruszyć z konkretnym zadaniem z Fazy A (np. S1 lub nowe reżimy Early Warning)?