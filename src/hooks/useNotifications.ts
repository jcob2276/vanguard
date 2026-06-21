import { useEffect } from 'react';

export function useNotifications() {
  useEffect(() => {
    // Prośba o uprawnienia przy starcie (tylko raz)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkTime = () => {
      const now = new Date();
      // Sprawdzamy czy jest dokładnie 20:30 (z tolerancją do minuty)
      if (now.getHours() === 20 && now.getMinutes() === 30) {
        if (Notification.permission === "granted") {
          // Zapobiegamy wielokrotnym powiadomieniom w tej samej minucie
          let lastNotified: string | null = null;
          try { lastNotified = localStorage.getItem('last_reminder_date'); } catch (_e) { /* unavailable */ }
          const today = now.toDateString();

          if (lastNotified !== today) {
            new Notification("🔥 SYSTEM: RAPORT WIECZORNY", {
              body: "Podsumuj dzisiejszy dzień i zaplanuj 5 zwycięstw na jutro!",
              icon: "/pwa-192x192.png",
              tag: 'daily-reminder',
              requireInteraction: true
            });
            try { localStorage.setItem('last_reminder_date', today); } catch (e) { console.warn('Storage warn:', e); }
          } else {
            try { localStorage.removeItem('last_reminder_date'); } catch (e) {}
          }
        }
      }
    };

    // Sprawdzaj co 30 sekund
    const interval = setInterval(checkTime, 30000);
    checkTime(); // Sprawdź od razu przy ładowaniu

    return () => clearInterval(interval);
  }, []);
}
