# Garmin Interval Extraction + Coach Report — Instrukcja dla modeli AI

## Cel

Wyciągnąć dane z Garmin Connect dla biegu **bez trybu Workout** (np. Forerunner 45), zrekonstruować czasy indywidualnych interwałów z per-sekundowego strumienia GPS, a następnie wygenerować wizualny raport HTML gotowy do druku PDF dla trenera.

---

## 1. Zależności i setup

```bash
pip install garminconnect garth
```

**Credentials (hardcode w skrypcie lub env):**
```python
EMAIL    = "jakubsobon3@gmail.com"
PASSWORD = "Czarek100!"
GC_ID    = 23248843197  # activityId z URL Garmin Connect lub get_activities()
```

**Logowanie:**
```python
from garminconnect import Garmin
api = Garmin(EMAIL, PASSWORD)
api.login()
```

> **Uwaga: rate limiting.** Garmin blokuje IP po zbyt wielu próbach logowania (429). Jeśli wystąpi `429`, użyj VPN (np. ProtonVPN, server PL) do pierwszego logowania. Po uzyskaniu tokenów sesji kolejne wywołania działają bez VPN. Tokeny cache'owane przez `garth`.

---

## 2. Pobieranie danych per-sekunda

```python
details = api.get_activity_details(GC_ID, 2000, 4000)
# Parametry: (activity_id, max_chart_size, max_polyline_size)
# 2000 / 4000 pokrywa biegi do ~2h z próbkowaniem ~5s
```

### Struktura odpowiedzi

```
details = {
  "metricDescriptors": [...],       # indeks → nazwa metryki
  "activityDetailMetrics": [...],   # lista próbek, każda to {"metrics": [float, float, ...]}
  "geoPolylineDTO": {...},
  "heartRateDTOs": [...],
  ...
}
```

### Budowanie mapy deskryptorów

```python
descriptors = details.get("metricDescriptors", [])
desc_map = {}  # metricsIndex -> key
for d in descriptors:
    idx = d.get("metricsIndex")
    key = d.get("key") or d.get("metricType")
    if idx is not None and key:
        desc_map[idx] = key
```

### Przykładowy `desc_map` (Forerunner 45, bieg 14.06.2026)

```python
{
    0: 'directFractionalCadence',   # ułamek kadencji — IGNORUJ
    1: 'directSpeed',               # prędkość m/s ← UŻYWAJ
    2: 'directUncorrectedElevation',
    3: 'directDoubleCadence',       # kadencja spm (obie nogi) ← UŻYWAJ
    4: 'directTimestamp',           # timestamp ms
    5: 'directLatitude',
    6: 'directRunCadence',          # połowa kadencji (1 noga) — ignoruj
    7: 'sumElapsedDuration',        # czas elapsed od startu [s] ← UŻYWAJ
    8: 'directElevation',
    9: 'sumDuration',
    10: 'directLongitude',
    11: 'sumDistance',              # dystans od startu [m] ← UŻYWAJ
    12: 'directCorrectedElevation',
    13: 'directHeartRate',          # HR bpm ← UŻYWAJ
    14: 'sumMovingDuration',
    15: 'directVerticalSpeed',
}
```

> **Indeksy MOGĄ się różnić między aktywnościami!** Zawsze buduj `desc_map` dynamicznie. Nie hardcode'uj numerów.

---

## 3. Wyszukiwanie indeksów kluczowych metryk

```python
# Prędkość — szukaj "speed" ale NIE "verticalspeed"
speed_idx = next((i for i, k in desc_map.items()
                  if "speed" in k.lower() and "vertical" not in k.lower()), None)

# HR — "heartrate" lub "heart_rate"
hr_idx = next((i for i, k in desc_map.items()
               if "heartrate" in k.lower() or "heart_rate" in k.lower()), None)

# Kadencja — directDoubleCadence = pelna kadencja spm; NIE FractionalCadence
cad_idx = next((i for i, k in desc_map.items() if "doublecadence" in k.lower()), None)
if cad_idx is None:
    cad_idx = next((i for i, k in desc_map.items() if "runcadence" in k.lower()), None)

# Elapsed time — case-insensitive szukaj "elapsed"
elapsed_idx = next((i for i, k in desc_map.items() if "elapsed" in k.lower()), None)

# Dystans — case-insensitive
dist_idx = next((i for i, k in desc_map.items() if "sumdistance" in k.lower()), None)
```

### Typowe pułapki (bugs znalezione w sesji)

| Problem | Przyczyna | Fix |
|---|---|---|
| `cad_idx` zwraca ułamek 0.5 | `directFractionalCadence` trafia pierwszy przy szukaniu "cadence" | Szukaj "doublecadence" z priorytetem |
| `elapsed_idx = None` | "elapsedDuration" ≠ "sumElapsedDuration" (wielka litera E po "sum") | Użyj `.lower()` i szukaj "elapsed" |
| Prędkość pobiera `directVerticalSpeed` | "speed" w nazwie pionowej prędkości | Dodaj `and "vertical" not in k.lower()` |

---

## 4. Ekstrakcja próbek

```python
speeds, hrs, elapsed_times, distances, cadences = [], [], [], [], []

for m in metrics:
    vals = m.get("metrics", []) if isinstance(m, dict) else (m if isinstance(m, list) else [])

    def get_val(idx):
        return vals[idx] if idx is not None and idx < len(vals) else None

    speeds.append(get_val(speed_idx))
    hrs.append(get_val(hr_idx))
    elapsed_times.append(get_val(elapsed_idx))
    distances.append(get_val(dist_idx))
    cadences.append(get_val(cad_idx))
```

**Charakterystyka danych (bieg 14.06.2026):**
- 898 próbek na 4189s biegu = ~4.67s/próbkę (NIE 1 próbka/sekundę)
- Speed: 0.76–4.36 m/s, avg 2.77 m/s
- HR: 101–195 bpm
- Cadence: 0–182 spm (0 na początku gdy stoisz)

---

## 5. Rekonstrukcja interwałów

```python
THRESHOLD = 3.0    # m/s = ~5:33/km — wszystko szybciej = interwał
MIN_SAMPLES = 5    # min próbek żeby policzyć jako segment

in_iv, start, intervals = False, 0, []

for i, spd in enumerate(speeds):
    fast = spd and spd >= THRESHOLD
    if fast and not in_iv:
        in_iv = True; start = i
    elif not fast and in_iv:
        in_iv = False
        if i - start >= MIN_SAMPLES:
            seg_spd = [s for s in speeds[start:i] if s]
            seg_hr  = [h for h in hrs[start:i] if h]
            seg_cad = [c for c in cadences[start:i] if c]

            t_start = elapsed_times[start]
            t_end   = elapsed_times[i - 1]
            real_dur = (t_end - t_start) if (t_start and t_end) else None

            d_start = distances[start]
            d_end   = distances[i - 1]
            real_dist = (d_end - d_start) if (d_start and d_end) else None

            intervals.append({
                "avg_spd": sum(seg_spd)/len(seg_spd) if seg_spd else 0,
                "avg_hr":  sum(seg_hr)/len(seg_hr) if seg_hr else None,
                "avg_cad": sum(seg_cad)/len(seg_cad) if seg_cad else None,
                "dur_s":   real_dur,
                "dist_m":  real_dist,
                "samples": i - start,
            })
```

### Szacowanie czasu 400m z danych GPS

Segment nie zawsze = dokładnie 400m (brak trybu Workout → brak marker'ów dystansów). Skaluj czas do 400m:

```python
t400 = actual_time_s × (400 / actual_dist_m)
```

**Wyniki z 14.06.2026 (10×400m):**

| Rep | Elapsed [s] | Dist [m] | t400 [s] | t400 | Kadencja [spm] | HR | vs cel (1:54) |
|-----|-------------|----------|----------|------|----------------|----|--------------|
| 1 | 100 | 379 | 106 | 1:46 | 182 | 160 | −8s |
| 2 | 122 | 425 | 115 | 1:55 | 178 | 186 | +1s |
| 3 | 95 | 360 | 106 | 1:46 | 182 | 188 | −8s |
| 4 | 95 | 346 | 110 | 1:50 | 177 | 189 | −4s |
| 5 | 105 | 378 | 111 | 1:51 | 180 | 176 | −3s |
| 6 | 109 | 373 | 117 | 1:57 | 175 | 185 | +3s |
| 7 | 108 | 388 | 111 | 1:51 | 177 | 180 | −3s |
| 8 | 94 | 341 | 110 | 1:50 | 180 | 186 | −4s |
| 9 | 99 | 382 | 104 | 1:44 | 178 | 183 | −10s |
| 10 | 101 | 389 | 104 | 1:44 | 182 | 179 | −10s |

**Avg: 1:49 | Best: 1:44 | Worst: 1:57 | Cel: 1:54**

---

## 6. Dane podsumowania aktywności

```python
acts = api.get_activities(0, 5)
run = next((a for a in acts if a.get("activityId") == GC_ID), None)

# Kluczowe pola:
run["averageRunningCadenceInStepsPerMinute"]  # avg kadencja biegu (obejmuje trucht+sprint)
run["trainingEffectLabel"]
run["vo2MaxValue"]
```

**Uwaga:** `averageRunningCadenceInStepsPerMinute` = avg z CAŁEGO biegu (warmup + trucht + interwały). Dla 14.06.2026: **161 spm** (choć interwały miały 175–182 spm — trucht zaniża).

---

## 7. Dane zewnętrzne (nie-Garmin)

| Dane | Źródło | Format w raporcie |
|---|---|---|
| Sen (godziny, score) | Oura Ring (raport md) | `sleep:'7h06'`, `sleepH:7.06`, `readiness:83` |
| HRV | Oura Ring | `hrv:55.7` |
| Białko / kcal / węgle | Yazio (raport md) | `protein:73`, `kcal:1628`, `carbs:134` |
| Masa ciała | Garmin/Yazio | `weight:74.7` |
| Best efforts (5K, 10K PR) | Strava API | hardcode w raporcie |
| Warunki pogodowe | Vanguard raport (z Open-Meteo) | `wiatr 43 km/h · 14.4°C` |
| Trening Plan / RPE | Z komentarza do aktywności lub raportu Vanguard | `RPE:8`, `plan:'10×400m @ 4:45/km'` |

**Format raportu Vanguard** (md): `raport_kuba_RRRR-MM-DD.md` — zawiera pola `### Nawyki Dnia` itd.

> **⚠️ PRYWATNOŚĆ — ABSOLUTNA ZASADA:**
> Sekcja `### Nawyki Dnia` z raportu Vanguard zawiera bardzo prywatne dane osobiste i **NIGDY** nie może być zawarta w raporcie wysyłanym trenerowi Igorowi. Używaj WYŁĄCZNIE danych sportowych i żywieniowych.

---

## 8. Progi kolorów (traffic light) dla raportu

| Metryka | Zielony | Żółty | Czerwony |
|---|---|---|---|
| Readiness (Oura) | ≥85 | ≥75 | <75 |
| HRV | ≥62 ms | ≥52 ms | <52 ms |
| Sen | ≥7h | ≥6.5h | <6.5h |
| Kcal | ≥1900 | ≥1600 | <1600 |
| Białko | ≥110g | ≥85g | <85g |
| Węgle | ≥300g | ≥200g | <200g |
| Kadencja (bieg) | ≥170 spm | ≥165 spm | <165 spm |
| Kadencja (interwał) | ≥180 spm | ≥175 spm | <175 spm |

---

## 9. Struktura raportu HTML

Raport to samodzielny plik HTML z Inter + Tabler Icons z CDN, `@media print` dla PDF.

```
[HEADER]
  Jakub Sobon · 10×400m · 14.06.2026
  Trener: Igor · 112 dni do Koszyce 4.10.2026

[KONTEKST 3 DNI]
  Karty: data, trening, readiness (dot), HRV (dot), sen (dot), kcal (pasek), białko (pasek), węgle (pasek), kadencja (dot)

[ALERTY]
  Niedobór białka (czerwony) + Niedobór węglowodanów (żółty) — jeśli poniżej progów

[WARUNKI POGODOWE]
  Baner żółty z ikoną wiatru

[DANE BIEGU]
  5 kafelków: km łącznie · czas · avg tempo · kadencja avg (sprint min–max) · kcal

[KPI TILES]
  Wykonanie X/10 · Śred. 400m · Best/Worst · PR jeśli było

[INTERWAŁY]
  Nagłówek: # | pasek | czas | tempo | HR | kad | vs cel
  Legenda: kolor zielony = poniżej celu, pomarańczowy = powyżej, linia = cel

[STREFY HR]
  Wykres słupkowy Z1–Z5 + minuty + Z4+Z5 łącznie

[BEST EFFORTS]
  400m · 1K · 5K · 10K (PR oznaczone pomarańczowym badge)

[WNIOSKI (3 punkty)]
  1. Kadencja / progresja
  2. Odżywianie
  3. PR / wynik szczegółowy

[FOOTER]
  Garmin Connect API + Oura Ring + Yazio · Vanguard OS · Antygravity
```

---

## 10. Pełny skrypt Python (gotowy do uruchomienia)

Skrypt jest w `scripts/garmin_interval_detail.py`. Uruchom:

```bash
cd /path/to/Vanguard
python scripts/garmin_interval_detail.py
```

Wydrukuje szczegóły per interwał:
```
[1] 100s | 379m | 4:24/km HR 160 | kad 182 spm
[2] 122s | 425m | 4:47/km HR 186 | kad 178 spm
...
```

Użyj tych danych do wypełnienia tablicy `ivs[]` w HTML.

---

## 11. Workflow krok po kroku dla modelu AI

```
1. Odczytaj raport Vanguard (raport_kuba_RRRR-MM-DD.md)
   → wyciągnij: sen, HRV, readiness, białko, kcal, węgle, masę, kadencję z opisu
   ⚠️ POMIŃ sekcję "Nawyki Dnia"

2. Uruchom garmin_interval_detail.py (lub poproś użytkownika o uruchomienie)
   → uzyskaj per-interwał: elapsed_s, dist_m, avg_spd, avg_hr, avg_cad
   → oblicz t400 = elapsed_s × (400 / dist_m)

3. Oblicz statystyki:
   avg_t400 = mean(t400)
   best_t400 = min(t400)
   worst_t400 = max(t400)
   n_on_target = count(t400 <= TARGET_S)

4. Zidentyfikuj kontekst:
   - maratona: Koszyce (Košice, Slovakia), 4.10.2026
   - dni do maratonu od daty biegu
   - warunki pogodowe z raportu
   - buty z opisu aktywności Garmin

5. Wypełnij szablon HTML:
   - days[] array (3 ostatnie dni)
   - ivs[] array (z cad per rep)
   - KPI tiles
   - alerty jeśli białko < 110g lub węgle < 300g

6. Zapisz jako raport_igor_DDMMRRRR.html
   → użytkownik otwiera w Chrome → Ctrl+P → PDF → wysyła Igorowi
```

---

## 12. Kontekst sportowy Jakuba (stałe dane)

| Parametr | Wartość |
|---|---|
| Masa ciała | ~74.7 kg |
| Cel maraton | Koszyce 4.10.2026 |
| Target kadencja | ≥170 spm (bieg), ≥180 spm (sprint) |
| Cel białko/dzień | 130g |
| Cel węgle (dzień treningowy) | ~400g (6g/kg × ~74kg) |
| 10K PR | 1:01:39 (pobity 14.06.2026) |
| 5K PR | 26:27 |
| Sub-goal | 10K sub-60:00 przed 4.10.26 |
| Trener | Igor |
| Buty | ASICS Novablast 5 |

---

## 13. Znane osobliwości Forerunner 45

- Brak trybu Workout → brak per-lap data → konieczna rekonstrukcja z GPS
- `lapDTOs` zwraca 1 lap (cały bieg), `lengthDTOs` = 0
- `exerciseSets` = null
- Próbkowanie: ~4–5s/próbka (nie per-sekunda mimo nazwy)
- `averageRunningCadenceInStepsPerMinute` = łącznie cały bieg (warmup + trucht + sprint)
- Kadencja podczas interwałów jest 175–182 spm (wyciągana tylko z per-second stream)
- `directDoubleCadence` = pełna kadencja spm; `directRunCadence` = połowa (1 noga); `directFractionalCadence` = ułamek — ten ostatni IGNORUJ
