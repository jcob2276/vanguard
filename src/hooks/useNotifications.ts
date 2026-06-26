import { useEffect } from 'react';
import { getTodayWarsaw } from '../lib/date';

function getWarsawHourMinute(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  };
}

export function useNotifications() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkTime = () => {
      const { hour, minute } = getWarsawHourMinute();
      if (hour === 20 && minute === 30) {
        if (Notification.permission === "granted") {
          let lastNotified: string | null = null;
          try { lastNotified = localStorage.getItem('last_reminder_date'); } catch (_e) { /* unavailable */ }
          const today = getTodayWarsaw();

          if (lastNotified !== today) {
            new Notification("🔥 SYSTEM: RAPORT WIECZORNY", {
              body: "Podsumuj dzisiejszy dzień i zaplanuj 5 zwycięstw na jutro!",
              icon: "/pwa-192x192.png",
              tag: 'daily-reminder',
              requireInteraction: true
            });
            try { localStorage.setItem('last_reminder_date', today); } catch (_e) { /* unavailable */ }
          }
        }
      }
    };

    const interval = setInterval(checkTime, 30_000);
    checkTime();
    return () => clearInterval(interval);
  }, []);
}
