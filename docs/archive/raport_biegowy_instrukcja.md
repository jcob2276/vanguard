# Instrukcja: Raport Treningowy dla Trenera (format Igor)

Dotyczy pliku: `raport_igor_DDMMYYYY.html` na Desktopie.

---

## Co potrzebujesz na wejściu

1. **Plik MD z raportem dobowym** — generowany przez aplikację Vanguard, zawiera:
   - Dane Oura Ring (Readiness, HRV, sen, kroki, strefy stresu)
   - Dane biegowe Strava (dystans, tempo, splity, strefy HR)
   - Dane żywieniowe Yazio (kcal, makro)
   - Kontekst tożsamości/celów (Rozdział 0)

2. **Garmin Connect** — konto `jakubsobon3@gmail.com`, hasło w `scripts/garmin_auth.py`

3. **Python + garminconnect** — `pip show garminconnect` (zainstalowane, v0.3.5)

---

## Środowisko — ważne szczegóły

- **Python na Windows**: użyj `py` zamiast `python` lub `python3` (launcher Windowsowy)
- **Hasło Garmin**: trzymane w `C:\Users\jakub\Desktop\Vanguard\.env` jako `GARMIN_EMAIL` / `GARMIN_PASSWORD`
- **load_dotenv**: gdy skrypt jest poza katalogiem projektu — zawsze podaj jawną ścieżkę:
  ```python
  from dotenv import load_dotenv
  load_dotenv(r'C:\Users\jakub\Desktop\Vanguard\.env')
  ```
- **Tokeny Garmin** w `scripts/.garmin_tokens/` — jeśli login nie działa (401/pustce JSON), usuń folder i zaloguj się świeżo: `rmdir /s /q scripts\.garmin_tokens`
- **Temperatura pogodowa z Garmin**: wartości w °F, przelicz na °C: `(F - 32) * 5/9`
- **`get_activity()` zwraca null pola** — NIE używaj do summary stats. Używaj `get_activity_splits(AID)` → `lapDTOs[0]` dla globalnych metryk biegu

---

## Krok 1 — Pobierz kadencję per km z Garmin API

```bash
cd C:\Users\jakub\Desktop\Vanguard
python -c "
from garminconnect import Garmin

EMAIL    = 'jakubsobon3@gmail.com'
PASSWORD = '...'   # patrz scripts/garmin_auth.py — nie wklejaj hasła tutaj

api = Garmin(EMAIL, PASSWORD)
api.login()

# Znajdź activity ID dla konkretnej daty
acts = api.get_activities_by_date('YYYY-MM-DD', 'YYYY-MM-DD', 'running')
print([(a['activityId'], round(a.get('distance',0)/1000,2)) for a in acts])
"
```

Następnie pobierz splity z kadencją — **ważne: deskryptory muszą być z TEGO SAMEGO wywołania co metryki** (kolejność indeksów zmienia się przy każdym logowaniu):

```python
from garminconnect import Garmin

api = Garmin('jakubsobon3@gmail.com', '...')  # hasło z scripts/garmin_auth.py
api.login()

details = api.get_activity_details(ACTIVITY_ID, 2000, 4000)
descriptors = details.get('metricDescriptors', [])
metrics     = details.get('activityDetailMetrics', [])

# Buduj mapę key → pozycja z TEGO wywołania
pos = {d['key']: d['metricsIndex'] for d in descriptors}

DIST = pos['sumDistance']
CAD  = pos['directDoubleCadence']   # pełna kadencja spm (obie nogi)
HR   = pos['directHeartRate']
SPD  = pos['directSpeed']           # m/s
ELEV = pos['directCorrectedElevation']

km_data = {}
for m in metrics:
    v = m['metrics']
    dist = v[DIST]
    if not dist: continue
    km = int(dist // 1000) + 1
    if km > 15: continue
    if km not in km_data:
        km_data[km] = {'cad':[], 'hr':[], 'spd':[], 'elev':[]}
    seg = km_data[km]
    cad  = v[CAD];  hr = v[HR];  spd = v[SPD];  elev = v[ELEV]
    if cad  and  50 < cad  < 300: seg['cad'].append(cad)
    if hr   and  40 < hr   < 220: seg['hr'].append(hr)
    if spd  and 0.5 < spd  < 8:   seg['spd'].append(spd)
    if elev: seg['elev'].append(elev)

for km in sorted(km_data.keys()):
    seg = km_data[km]
    spd_avg = sum(seg['spd'])/len(seg['spd']) if seg['spd'] else 0
    hr_avg  = round(sum(seg['hr'])/len(seg['hr'])) if seg['hr'] else 0
    cad_avg = round(sum(seg['cad'])/len(seg['cad'])) if seg['cad'] else 0
    elev_net = round(seg['elev'][-1] - seg['elev'][0], 1) if len(seg['elev']) >= 2 else 0
    pace_str = f'{int(1000/spd_avg//60)}:{int(1000/spd_avg%60):02d}' if spd_avg else '--'
    print(f'km{km}: {pace_str}/km HR{hr_avg} {cad_avg}spm {elev_net:+.1f}m')
```

### Segmentacja per-dystans dla interwałów (NIE per km geograficzny)

Gdy bieg ma strukturę interwałową (np. 5×1km z przerwami), **nie używaj segmentacji per km** — granice geograficzne nie pokrywają się z granicami interwałów. Zamiast tego zdefiniuj segmenty po dystansie i filtruj `sumDistance`:

```python
segments = [
    ('Rozgrzewka 1',    0,    1000),
    ('Rozgrzewka 2', 1000,    2000),
    ('INT #1',       2000,    3000),
    ('Przerwa 1',    3000,    3500),
    ('INT #2',       3500,    4500),
    ('Przerwa 2',    4500,    5000),
    ('INT #3',       5000,    6000),
    ('Przerwa 3',    6000,    6500),
    ('INT #4',       6500,    7500),
    ('Przerwa 4',    7500,    8000),
    ('INT #5',       8000,    9000),
    ('Cooldown',     9000,   11000),
]

seg_data = {s[0]: {'cad':[], 'hr':[], 'spd':[], 'elev':[]} for s in segments}

for m in metrics:
    v = m['metrics']
    dist = v[DIST]
    if dist is None: continue
    for name, start, end in segments:
        if start <= dist < end:
            cad = v[CAD]; hr = v[HR]; spd = v[SPD]
            elev = v[ELEV] if ELEV is not None else None
            d = seg_data[name]
            if cad  and  50 < cad  < 300: d['cad'].append(cad)
            if hr   and  40 < hr   < 220: d['hr'].append(hr)
            if spd  and 0.5 < spd  < 10:  d['spd'].append(spd)
            if elev: d['elev'].append(elev)
            break  # punkt należy tylko do jednego segmentu

for name, start, end in segments:
    d = seg_data[name]
    spd_avg = sum(d['spd'])/len(d['spd']) if d['spd'] else 0
    hr_avg  = round(sum(d['hr'])/len(d['hr'])) if d['hr'] else 0
    cad_avg = round(sum(d['cad'])/len(d['cad'])) if d['cad'] else 0
    elev_net = round(d['elev'][-1]-d['elev'][0], 1) if len(d['elev']) >= 2 else 0
    pace_str = f'{int(1000/spd_avg//60)}:{int(1000/spd_avg%60):02d}' if spd_avg else '--'
    print(f'{name:15s} [{start/1000:.1f}-{end/1000:.1f}km]: {pace_str}/km  HR{hr_avg}  {cad_avg}spm  {elev_net:+.1f}m')
```

Granice segmentów zawsze ustal z Jakubem PRZED pisaniem HTML — "pierwsze 2km rozgrzewka, 1km biegu + 500m przerwy" oznacza np. 2-3, 3.5-4.5 itd., nie 0-1, 1-2.

### Gotowy skrypt jednorazowy
`scripts/garmin_activity_detail.py` — zmień `GC_ID` na ID aktywności i odpał.
Działający skrypt z sesji 02.07.2026 (interwały): `C:\Users\jakub\AppData\Local\Temp\claude\...\scratchpad\garmin_intervals.py`

### Problemy z logowaniem
- **429 (IP rate limit)** — odczekaj 10–15 min lub użyj VPN przy pierwszym logowaniu
- **401 (błędne hasło)** — aktualne hasło zawsze w `scripts/garmin_auth.py`
- **Tokeny** — po udanym logowaniu zapisują się w `scripts/.garmin_tokens/`; kolejne logowania są szybsze

---

## Krok 2 — Dane z pliku MD

Z raportu MD wyciągnij dla każdego z 3 dni (kontekst):

| Pole | Skąd |
|------|------|
| Readiness | Oura Ring → `Readiness:` |
| HRV śr | Oura Ring → `Średnie HRV:` |
| Sen | Oura Ring → `Sen:` (pierwsze h.mm) |
| Kcal / Białko / Węgle | Dieta → `Suma dnia:` |
| Kadencja avg | Strava → nagłówek biegu → `Kadencja:` |
| Strefy HR | Strava → `Strefy HR (GC):` |
| Splity (tempo, GAP, HR, elev) | Strava → tabela `Splity:` |
| Pogoda | Strava → `Garmin Connect:` |
| Best Efforts | Strava → tabela `Best Efforts:` |

---

## Krok 3 — Buduj HTML

Szablon: `raport_igor_18062026.html` na Desktopie — skopiuj i podmień dane.

### Struktura raportu (kolejność sekcji)

1. **Topbar** — data/godzina + "Raport Treningowy · Jakub Sobon · DD.MM.YYYY"
2. **Tytuł** — `Jakub Sobon · Bieg ZX · DD.MM.YYYY` + liczba dni do maratonu (4.10.2026)
   - Klasyfikacja biegu: Z3 = spokojny, Z3/Z4 = mieszany, Z4 = progowy
   - Dni do maratonu = policz ręcznie lub użyj: `(date(2026,10,4) - date(rok,mies,dzień)).days`
3. **Kontekst 3 dni** — tabela: DATA / TRENING / READINESS (dot) / HRV / SEN (dot) / KCAL (bar) / BIAŁKO (bar) / WĘGLE (bar) / KADENCJA
4. **Alerty** — max 3, żółty/czerwony/niebieski. Priorytety: sen, kadencja, coś pozytywnego lub ostrzegawczego
5. **Warunki pogodowe** — pasek z temp / wilg / wiatr / zachmurzenie / komentarz
6. **Dane biegu** — 5 metryk: DYSTANS / CZAS RUCHU / ŚR. TEMPO (max) / KADENCJA (krok cm) / ŚR. HR (max)
7. **Splity** — z Stravy (tempo, GAP, HR, wzniesienie) + kadencja z Garmin API; kolory: zielony=najszybszy, pomarańczowy=najwolniejszy
8. **Strefy tętna** — Z1–Z5 bary + komentarz jeśli Z4+Z5 > 20% na biegu regeneracyjnym
9. **Best Efforts** — z deltą vs poprzedni bieg (zielony ▲ = poprawa, czerwony ▼ = regres)
10. **Wnioski dla trenera** — 3 punkty numerowane: zwykle kadencja / żywienie lub sen / pozytywne
11. **Footer** — źródła danych + "Vanguard OS · Antigravity · wygenerowano DD.MM.YYYY"

### Kolory dot (Readiness/Sen)
- 🟢 Zielony: Readiness ≥ 83, Sen ≥ 7h
- 🟠 Pomarańczowy: Readiness 74–82, Sen 6–7h
- 🔴 Czerwony: Readiness ≤ 73, Sen < 6h

### Kolory barów (Kcal/Białko/Węgle)
- 🟢 Zielony: kcal ≥ 2500 (dzień nieaktywny) / białko ≥ 160g / węgle ≥ 300g
- 🟡 Żółty: kcal 1900–2500 / białko 120–160g / węgle 200–300g
- 🔴 Czerwony: kcal < 1900 / białko < 120g / węgle < 200g

### Klasyfikacja biegu
- **Łatwy Z3** — Z3 > 75%, RPE ≤ 3, HR śr < 158
- **Z3/Z4 mieszany** — Z4 > 20%, RPE 4–5
- **Progowy Z4** — Z4 > 50%, RPE ≥ 6
- **Interwałowy** — Z4/Z5 > 30% + wyraźne segmenty szybkie

### Raport interwałowy — dodatkowe sekcje HTML

Gdy bieg jest interwałowy (typ: `Interwały X×Ykm`), dodaj między "Dane biegu" a "Splity":

**Sekcja: Progresja interwałów** — blok z X kolumnami (jedna na interwał) pokazujący tempo, HR, kadencję. Ostatni interwał wyróżniony ciemniejszym kolorem jeśli był najszybszy. Pod blokiem: `Poprawa #1→#X: −Ns/km`.

**Sekcja: Segmenty — Garmin API per metr dystansu** — tabela z WSZYSTKIMI segmentami (rozgrzewka, int #1, przerwa 1, int #2..., cooldown). Dla każdego: tag (kolor), zakres km, tempo, bar wizualny, HR śr, kadencja, wzniesienie netto. Tagi: `tag-int` (zielony) dla interwałów, `tag-rest` (szary) dla przerw, `tag-base` (niebieski) dla rozgrzewki/cooldown, `tag-int-best` (ciemnozielony wypełniony) dla najszybszego interwału.

**Stopka tabeli**: zawsze dodaj zdanie wyjaśniające źródło: "Dane: Garmin Connect API — `get_activity_details` → `metricDescriptors` (mapowanie key→index) + `activityDetailMetrics`, segmentowane po `sumDistance`."

### Profil biegowy Jakuba (kontekst dla wniosków)

- **VO2max**: 47.1 (Cooper test, PR 1km: 4:25 świeży/max)
- **Cel**: sub-4h Koszyce 4.10.2026 (tempo docelowe: 5:41/km)
- **VO2max 47.1 = teoretyczny maraton ~3:41–3:45** — VO2max nie jest bottleneckiem, jest zapas
- **Bottlenecki**: ekonomia biegu (kadencja na easy), próg mleczanowy, akumulacja km
- **Buty**: ASICS Novablast 5
- **Trener**: Igor
- **Overstriding pattern**: kadencja 155 spm na easy vs 170-173 spm na interwałach — problem nawykowy, nie mechaniczny. Rekomendacja: metronom 170 spm na easy
- **Normy kadencji** dla Jakuba: <160 spm = problem, 165-170 = ok na easy, 170-175 = dobry interwał

---

## Krok 4 — Druk do PDF

1. Otwórz HTML w **Chrome lub Edge**
2. `Ctrl+P`
3. Ustawienia:
   - **Grafika tła** → WŁĄCZ (inaczej bary i doty znikają)
   - **Nagłówki i stopki** → wyłącz
   - **Marginesy** → Brak lub Minimalne
   - **Skala** → 100%
4. Zapisz jako PDF: `raport_igor_DDMMYYYY.pdf`

---

## Pliki referencyjne

| Plik | Opis |
|------|------|
| `scripts/garmin_auth.py` | Dane logowania + schemat tokenów |
| `scripts/garmin_activity_detail.py` | Szczegóły aktywności + per-sekundowe metryki |
| `scripts/garmin_enrich.py` | Sync Garmin → Supabase |
| `scripts/.garmin_tokens/` | OAuth tokeny (po pierwszym logowaniu) |
| `Desktop/raport_igor_18062026.html` | Szablon raportu dla Igora |
| `Desktop/raporcik ER 65.pdf` | Wzorcowy PDF raportu (16.06.2026) |

---

## Gotowe fragmenty

### Liczba dni do maratonu
```python
from datetime import date
print((date(2026, 10, 4) - date.today()).days)
```

### Krok biegu (cm) z kadencji i tempa
```
krok_cm = (1000 / (kadencja_spm / 60)) * 100 / tempo_mps
# np. 160 spm, 2.37 m/s → krok = (1000 / 2.667) * 100 / 2.37... 
# prostsze: krok_cm = round(prędkość_ms / (kadencja_spm / 60) * 100)
krok_cm = round(2.37 / (160/60) * 100)  # → ~89 cm
```
