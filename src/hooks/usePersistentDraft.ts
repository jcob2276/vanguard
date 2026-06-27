import { useEffect, useState } from 'react';

/**
 * Drop-in useState replacement backed by localStorage. Android frequently kills a
 * backgrounded PWA tab to reclaim memory; on return the app does a fresh mount and
 * plain useState defaults back to empty, silently wiping whatever the user had typed.
 * Pass `key: null` to disable persistence (e.g. before a userId is known).
 */
export function usePersistentDraft<T>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (!key) return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!key) return;
    try {
      const isBlank =
        value == null ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
      if (isBlank) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
