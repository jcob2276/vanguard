import { supabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notify } from './notify';

// Dynamic table dispatch requires bypassing the generic table-name constraint.
// This is intentional — the offline queue replays arbitrary serialised writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dynDb = supabase as SupabaseClient<any>;

const DB_NAME = 'vanguard_offline';
const STORE_NAME = 'queue';
const DLQ_STORE_NAME = 'dead_letter';
const DB_VERSION = 2;

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
      if (!db.objectStoreNames.contains(DLQ_STORE_NAME)) {
        db.createObjectStore(DLQ_STORE_NAME, { keyPath: 'id' });
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

async function saveToDeadLetterQueue(entry: QueueEntry, error: unknown): Promise<void> {
  try {
    const db = await openDb();
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error)
        ? String((error as Record<string, unknown>).message)
        : String(error);
    const errCode = (typeof error === 'object' && error !== null && 'code' in error)
      ? String((error as Record<string, unknown>).code)
      : null;

    const dlqEntry = {
      ...entry,
      failedAt: Date.now(),
      errorMessage: errMsg,
      errorCode: errCode,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DLQ_STORE_NAME, 'readwrite');
      tx.objectStore(DLQ_STORE_NAME).add(dlqEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('[offlineQueue] Failed to save entry to DLQ:', err);
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
    const { error } = await dynDb.rpc(fn, args);
    if (error) throw error;
    return { queued: false };
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      await queueOfflineWrite(fn, args, label);
      return { queued: true };
    }
    throw err;
  }
}

let flushing = false;

async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  flushing = true;
  try {
    const entries = await getQueuedWrites();
    if (!entries.length) return;
    let synced = 0;
    for (const entry of entries) {
      let error = null;
      if (entry.fn.startsWith('table:')) {
        const [_, action, table] = entry.fn.split(':');
        if (action === 'insert') {
          const res = await dynDb.from(table).insert((entry.args.payload as Record<string, unknown>) || {});
          error = res.error;
        } else if (action === 'update') {
          const res = await dynDb.from(table).update((entry.args.payload as Record<string, unknown>) || {}).match((entry.args.match as Record<string, unknown>) || {});
          error = res.error;
        } else {
          const res = await dynDb.from(table).delete().match((entry.args.match as Record<string, unknown>) || {});
          error = res.error;
        }
      } else {
        const res = await dynDb.rpc(entry.fn, entry.args);
        error = res.error;
      }

      if (error) {
        if (isOfflineError(error)) {
          console.debug(`[offlineQueue] Network offline during replay for ${entry.fn}. Stopping queue flush.`);
          break; // Stop - we are offline again, keep in queue
        } else {
          console.error(`[offlineQueue] Persistent error during replay for ${entry.fn}:`, error);
          // Move to Dead Letter Queue to avoid blocking the entire queue (poison pill prevention)
          await saveToDeadLetterQueue(entry, error);
          await removeQueuedWrite(entry.id);
          notify(`Synchronizacja nie powiodła się dla "${entry.label}". Szczegóły: ${error.message || String(error)}`, 'error');
          continue; // Move to next item
        }
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
