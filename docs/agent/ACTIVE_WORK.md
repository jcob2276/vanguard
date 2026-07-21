# Active Work

## Stan: Capacitor Android — Faza 5 + 6 ✅ (2026-07-21)

### DONE (Faza 5 — sync w tle)

- `TelemetryForegroundService` — FGS typu `location`, powiadomienie „Sync aktywny”
- `BackgroundSyncPlugin` — start/stop, tick co ~15 min → `syncPhoneUsageToday` + `syncLocationNow`
- Wizard w ⚙️ Ustawienia: bateria, autostart (Xiaomi/OPPO/Vivo/Huawei fallback), GPS, toggle sync w tle
- `locationSync` — watchPosition nie zatrzymuje się gdy FGS aktywny
- Manifest: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`

### DONE (Faza 6 — polish)

- Ikona launchera z `public/pwa-*.png` (tło adaptive `#1C1917`)
- Share target `ACTION_SEND text/plain` → `/links` lub `/keep`
- Static shortcuts: Zadania, Linki, Notatki (`res/xml/shortcuts.xml`)
- Deep links `https://localhost/...` + `ShareIntentPlugin` + `initNativeIntents`

### NEXT

- Faza 7 (opcjonalnie): widgety
- Final (~3 tyg.): Oura Gen 3 BLE (noop slice) — wymaga FGS

### DONE wcześniej

- Faza 4 lokalizacja → `location_history`
- Faza 3 Usage Stats → `phone_usage_daily`
- Faza 2 FCM push
- Faza 1 bootstrap Capacitor
