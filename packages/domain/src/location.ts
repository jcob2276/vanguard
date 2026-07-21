/** Haversine distance in meters — shared with stats export POI checks. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface LocationPoi {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export const DEFAULT_HOME_RADIUS_M = 150;

export const RZESZOW_POI: LocationPoi = {
  name: 'Rzeszów',
  lat: 50.0413,
  lng: 21.999,
  radiusM: 5000,
};

export function resolvePlaceName(
  latitude: number,
  longitude: number,
  pois: LocationPoi[],
): string | null {
  for (const poi of pois) {
    if (haversineDistanceMeters(latitude, longitude, poi.lat, poi.lng) <= poi.radiusM) {
      return poi.name;
    }
  }
  return null;
}

export function shouldSampleLocation(
  latitude: number,
  longitude: number,
  last: { lat: number; lng: number; atMs: number } | null,
  nowMs: number,
  minIntervalMs: number,
  minDistanceM: number,
): boolean {
  if (!last) return true;
  if (nowMs - last.atMs >= minIntervalMs) return true;
  return haversineDistanceMeters(latitude, longitude, last.lat, last.lng) >= minDistanceM;
}
