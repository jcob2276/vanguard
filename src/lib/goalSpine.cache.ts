const CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  data?: T;
  ts: number;
  inflight?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const invalidateListeners = new Set<() => void>();

export function spineKey(...parts: string[]) {
  return parts.join(':');
}

export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry?.data !== undefined && now - entry.ts < CACHE_TTL_MS) {
    return entry.data;
  }
  if (entry?.inflight) {
    return entry.inflight;
  }

  const inflight = fetcher()
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { ...(entry ?? {}), inflight, ts: entry?.ts ?? 0 });
  return inflight;
}

/** Drop cached reads after writes (weekly review, sprint goal, life_goals, projects). */
export function invalidateGoalSpineCache(userId?: string): void {
  if (!userId) {
    cache.clear();
  } else {
    for (const key of [...cache.keys()]) {
      if (key.includes(userId)) cache.delete(key);
    }
  }
  invalidateListeners.forEach((fn) => fn());
}

export function onGoalSpineInvalidated(listener: () => void): () => void {
  invalidateListeners.add(listener);
  return () => invalidateListeners.delete(listener);
}
