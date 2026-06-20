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

### Gotowy skrypt jednorazowy
`scripts/garmin_activity_detail.py` — zmień `GC_ID` na ID aktywności i odpał.

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
