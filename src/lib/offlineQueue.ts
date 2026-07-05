import { supabase } from './supabase';
import { notify } from './notify';

const DB_NAME = 'vanguard_offline';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

interface QueueEntry {
  id: string;
  fn: string;
  args: Record<string, unknown>;
  label: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Best-effort network-failure detector. Only errors that look like a genuine
 * connectivity drop get queued for later replay — real app errors (auth, RLS,
 * bad input, validation) must still surface to the user immediately, not sit
 * silently in a queue that will just fail again once "synced".
 */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}

export async function queueOfflineWrite(fn: string, args: Record<string, unknown>, label: string): Promise<void> {
  const db = await openDb();
  const entry: QueueEntry = { id: crypto.randomUUID(), fn, args, label, createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getQueuedWrites(): Promise<QueueEntry[]> {
  const db = await openDb();
  const entries = await new Promise<QueueEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueueEntry[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

async function removeQueuedWrite(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueuedWriteCount(): Promise<number> {
  try {
    return (await getQueuedWrites()).length;
  } catch {
    return 0;
  }
}

/**
 * Calls a Supabase RPC; on a genuine network failure, queues the call (by
 * function name + args — RPCs are plain JSON-serializable calls, so this is
 * generic across any mutation) instead of throwing, so the caller can show
 * "saved offline, will sync" rather than a hard error.
 */
export async function rpcWithOfflineFallback(
  fn: string,
  args: Record<string, unknown>,
  label: string,
): Promise<{ queued: boolean }> {
  try {
    const { error } = await supabase.rpc(fn as any, args as any);
    if (error) throw error;
    return { queued: false };
  } catch (err) {
    if (isOfflineError(err)) {
      await queueOfflineWrite(fn, args, label);
      return { queued: true };
    }
    throw err;
  }
}

let flushing = false;

export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  flushing = true;
  try {
    const entries = await getQueuedWrites();
    if (!entries.length) return;
    let synced = 0;
    for (const entry of entries) {
      const { error } = await supabase.rpc(entry.fn as any, entry.args as any);
      if (error) {
        console.error(`[offlineQueue] Replay failed for ${entry.fn}:`, error);
        break; // stop — likely still offline or a persistent error; keep the rest queued in order
      }
      await removeQueuedWrite(entry.id);
      synced++;
    }
    if (synced > 0) {
      notify(
        synced === 1 ? '1 zaległy zapis offline zsynchronizowany' : `${synced} zaległych zapisów offline zsynchronizowanych`,
        'success',
      );
    }
  } finally {
    flushing = false;
  }
}

/** Call once on app start — flushes anything queued from a previous offline session
 * and retries automatically whenever the browser regains connectivity. */
export function initOfflineSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => { void flushOfflineQueue(); });
  if (navigator.onLine) void flushOfflineQueue();
}
