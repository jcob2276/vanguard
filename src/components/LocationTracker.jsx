import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';

export default function LocationTracker({ session }) {
  const { userSettings, fetchUserSettings } = useStore();
  const watchId = useRef(null);
  const lastSync = useRef(0);
  const lastCoords = useRef(null);

  useEffect(() => {
    if (!userSettings) fetchUserSettings();
  }, []);

  const POI = [
    { name: 'Dom', lat: userSettings?.home_lat, lng: userSettings?.home_lng, radius: 150 },
    { name: 'Rzeszów-Centrum', lat: 50.0168, lng: 22.0070, radius: 300 },
  ].filter(p => p.lat && p.lng);

  useEffect(() => {
    if (!session?.user?.id || !navigator.geolocation) return;

    const handlePosition = async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const now = Date.now();

      // 1. Odrzuć bardzo słabą dokładność (oszczędność szumu w bazie)
      if (accuracy > 150) return;

      // 2. Adaptive Logic: Oblicz dystans od ostatniego zapisu
      const timeSinceLastSync = now - lastSync.current;
      const distanceMoved = lastCoords.current 
        ? getDistance(lastCoords.current.lat, lastCoords.current.lng, latitude, longitude)
        : 999;

      // Zapisujemy tylko jeśli:
      // - Minęło 20 minut (stay-still keep-alive)
      // - LUB przesunęliśmy się o ponad 250 metrów (ruch)
      if (timeSinceLastSync > 20 * 60 * 1000 || distanceMoved > 250) {
        
        // Rozpoznaj czy jesteśmy w POI
        const currentPOI = POI.find(p => 
          getDistance(p.lat, p.lng, latitude, longitude) < p.radius
        );

        // Zapisz do bazy
        const { error } = await supabase.from('location_history').insert({
          user_id: session.user.id,
          latitude,
          longitude,
          accuracy,
          place_name: currentPOI ? currentPOI.name : null
        });

        if (!error) {
          lastSync.current = now;
          lastCoords.current = { lat: latitude, lng: longitude };
        }
      }
    };

    // Używamy watchPosition - system operacyjny sam decyduje kiedy nas powiadomić o zmianie
    // Jest to znacznie bardziej energooszczędne niż setInterval.
    watchId.current = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => console.warn('Błąd lokalizacji:', error.message),
      { 
        enableHighAccuracy: false, // FALSE = OS używa Wi-Fi/Cell (oszczędza baterię)
        maximumAge: 60000, 
        timeout: 15000 
      }
    );

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [session]);

  // Funkcja Haversine do liczenia dystansu w metrach
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  return null;
}
