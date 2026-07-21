/**
 * Native foreground location → location_history (Android/iOS Capacitor).
 * With FGS (Faza 5), watch continues while sync service is active.
 */
import { App } from '@capacitor/app';
import { Geolocation, type Position } from '@capacitor/geolocation';
import {
  DEFAULT_HOME_RADIUS_M,
  RZESZOW_POI,
  getWarsawDateString,
  resolvePlaceName,
  shouldSampleLocation,
  type LocationPoi,
} from '@vanguard/domain';
import {
  countLocationsToday,
  fetchLatestLocation,
  insertLocationPoint,
} from '../locationHistoryApi';
import { supabase } from '../supabase';
import { isNativePlatform } from './platform';
import { isBackgroundSyncRunning } from './backgroundSync';

const SYNC_THROTTLE_MS = 30 * 60 * 1000;
const MIN_MOVE_M = 200;
const WATCH_MIN_INTERVAL_MS = 5 * 60 * 1000;

let lastSaved: { lat: number; lng: number; atMs: number } | null = null;
let watchId: string | null = null;
let activeUserId: string | null = null;
let teardown: (() => void) | null = null;
let lastWatchSampleAt = 0;

export interface LocationSyncResult {
  ok: boolean;
  placeName?: string | null;
  error?: string;
  skipped?: boolean;
}

async function loadPois(userId: string): Promise<LocationPoi[]> {
  const pois: LocationPoi[] = [RZESZOW_POI];
  const { data } = await supabase
    .from('user_settings')
    .select('home_lat, home_lng')
    .eq('user_id', userId)
    .maybeSingle();
  if (data?.home_lat != null && data?.home_lng != null) {
    pois.unshift({
      name: 'Dom',
      lat: Number(data.home_lat),
      lng: Number(data.home_lng),
      radiusM: DEFAULT_HOME_RADIUS_M,
    });
  }
  return pois;
}

export async function hasLocationPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const perm = await Geolocation.checkPermissions();
    return perm.location === 'granted';
  } catch {
    return false;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    let perm = await Geolocation.checkPermissions();
    if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
      perm = await Geolocation.requestPermissions();
    }
    return perm.location === 'granted';
  } catch {
    return false;
  }
}

async function persistPosition(
  userId: string,
  position: Position,
  force: boolean,
): Promise<LocationSyncResult> {
  const now = Date.now();
  const { latitude, longitude } = position.coords;
  const accuracy = position.coords.accuracy ?? null;

  if (
    !force &&
    !shouldSampleLocation(latitude, longitude, lastSaved, now, SYNC_THROTTLE_MS, MIN_MOVE_M)
  ) {
    return { ok: false, skipped: true };
  }

  const pois = await loadPois(userId);
  const placeName = resolvePlaceName(latitude, longitude, pois);
  const insert = await insertLocationPoint({
    user_id: userId,
    latitude,
    longitude,
    accuracy,
    place_name: placeName,
    is_manual: false,
  });

  if (!insert.ok) {
    return { ok: false, error: insert.error ?? 'insert_failed' };
  }

  lastSaved = { lat: latitude, lng: longitude, atMs: now };
  return { ok: true, placeName };
}

export async function syncLocationNow(userId: string, force = false): Promise<LocationSyncResult> {
  if (!isNativePlatform() || !userId) {
    return { ok: false, error: 'not_native' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: 'not_authenticated' };
    }

    const granted = await requestLocationPermission();
    if (!granted) {
      return { ok: false, error: 'location_denied' };
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 60_000,
    });

    return persistPosition(session.user.id, position, force);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'location_failed';
    console.error('[location] sync failed:', err);
    return { ok: false, error: message };
  }
}

async function hydrateLastSaved(userId: string): Promise<void> {
  try {
    const latest = await fetchLatestLocation(userId);
    if (!latest?.created_at) return;
    lastSaved = {
      lat: latest.latitude,
      lng: latest.longitude,
      atMs: new Date(latest.created_at).getTime(),
    };
  } catch {
    /* optional cache warm */
  }
}

async function startWatch(userId: string): Promise<void> {
  if (watchId || !userId) return;
  const granted = await hasLocationPermission();
  if (!granted) return;

  watchId = await Geolocation.watchPosition(
    { enableHighAccuracy: false, timeout: 20_000, maximumAge: 120_000 },
    (position, err) => {
      if (err || !position || !activeUserId) return;
      const now = Date.now();
      if (now - lastWatchSampleAt < WATCH_MIN_INTERVAL_MS) return;
      lastWatchSampleAt = now;
      void persistPosition(activeUserId, position, false);
    },
  );
}

async function stopWatch(): Promise<void> {
  if (!watchId) return;
  await Geolocation.clearWatch({ id: watchId });
  watchId = null;
}

export function initLocationSync(userId: string): () => void {
  if (!isNativePlatform() || !userId) return () => {};

  if (teardown && activeUserId === userId) return teardown;

  teardown?.();
  activeUserId = userId;
  void hydrateLastSaved(userId);

  const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && activeUserId) {
      void syncLocationNow(activeUserId, false);
      void startWatch(activeUserId);
    } else if (!isBackgroundSyncRunning()) {
      void stopWatch();
    }
  });

  void syncLocationNow(userId, true);
  void startWatch(userId);

  teardown = () => {
    void resumeListener.then((h) => h.remove());
    void stopWatch();
    if (activeUserId === userId) {
      activeUserId = null;
      teardown = null;
    }
  };

  return teardown;
}

export async function fetchTodayLocationSummary(userId: string): Promise<{
  count: number;
  latestPlace: string | null;
}> {
  const dateStr = getWarsawDateString();
  const [count, latest] = await Promise.all([
    countLocationsToday(userId, dateStr).catch(() => 0),
    fetchLatestLocation(userId).catch(() => null),
  ]);
  return { count, latestPlace: latest?.place_name ?? null };
}
