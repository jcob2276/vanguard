## FEATURE:
Nowa karta `SleepDebtCard` w widoku Body — pokazuje dług snu skumulowany z ostatnich 7 dni
na podstawie danych z `oura_daily_summary`. Karta ma przycisk refresh który wywołuje `sync-oura`.

Wymagania:
- Czyta z `oura_daily_summary` (kolumny: `user_id`, `date`, `total_sleep_duration`, `sleep_score`)
- Oblicza dług snu: cel = 480 min/dobę, sumuje (cel - actual) z ostatnich 7 dni
- Wyświetla: skumulowany dług (min i h), średni wynik snu, trend (lepiej/gorzej niż poprzedni tydzień)
- Trzy stany tła: zielony (dług < 60 min), żółty (60–180 min), czerwony (> 180 min)
- Refresh button wywołuje `sync-oura` z userId, potem odświeża dane
- Brak danych Oura → DataStateNotice z instrukcją

## EXAMPLES:
- `examples/frontend-component.jsx` — wzorzec useState/useEffect/fetchRow/call()/DataStateNotice
- `src/components/biometrics/DailyStrainCard.jsx` — wzorzec refresh z wieloma równoległymi callami i error propagation
- `src/components/biometrics/OuraWidget.jsx` — jak czytać z `oura_daily_summary` z Warsaw date filterem

## DOCUMENTATION:
- Tabela `oura_daily_summary`: user_id, date (text 'YYYY-MM-DD'), total_sleep_duration (sekundy), sleep_score (0-100)
- Supabase JS: https://supabase.com/docs/reference/javascript/select

## OTHER CONSIDERATIONS:
- `total_sleep_duration` jest w sekundach — podziel przez 60 żeby dostać minuty
- Date filter musi używać Warsaw timezone: `toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })`
- Nie ma migracji — `oura_daily_summary` już istnieje
- Karta trafia do `src/components/biometrics/SleepDebtCard.jsx` i jest montowana w `Dashboard.jsx` w sekcji Body obok `DailyStrainCard`
