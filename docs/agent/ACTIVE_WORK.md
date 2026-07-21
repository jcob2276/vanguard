# Active Work

## Stan: Capacitor Android — Faza 1 bootstrap (2026-07-21)

### Model logistyczny (nie mieszać)
- **PWA** = Vercel, `npm run build` (mode default) — bez zmian
- **APK** = Capacitor shell, `npm run mobile:sync` → Android Studio
- Wspólny kod: `src/`. Natywne: `android/` + `src/lib/native/`
- Guard: `isNativePlatform()` — native API tylko za nim

### DONE (faza 1)
1. `@capacitor/core` + android + app/status-bar/splash-screen
2. `capacitor.config.ts` (`app.vanguard.os`)
3. `vite` mode `capacitor` → `base: './'`, bez PWA service worker
4. Skrypty: `mobile:build`, `mobile:sync`, `mobile:open`
5. Folder `android/` w repo

### Twój krok lokalny (blokuje APK)
1. Zainstaluj [Android Studio](https://developer.android.com/studio) (JDK 21 + Android SDK)
2. Ustaw `ANDROID_HOME` (Studio zwykle robi to samo)
3. `npm run mobile:sync`
4. `npm run mobile:open` → Build → Build APK(s)
5. Wgraj APK na telefon (USB debugging / sideload)

### NEXT (faza 2+)
- FCM push (obok Web Push w `vanguard-push-reminder`)
- Usage Stats → `phone_usage_daily`
- Geolocation (foreground → potem background)
