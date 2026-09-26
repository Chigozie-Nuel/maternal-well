/**
 * Maternawell Nigeria - Outbox Sync Engine
 * 
 * Rules:
 * - Every write enqueues to the IndexedDB `outbox` table.
 * - Flushes automatically on 'online', on app start, and every 60s while online.
 * - Exponential backoff on network failures: 5s initial, doubling up to 5 min (300,000ms) cap.
 * - Batches up to 50 operations.
 * - Updates per-record syncStatus ('pending' | 'synced' | 'failed').
 * - Facility-scoped delta pull (`/api/sync/pull?since=...`).
 */

import { db } from './db';

const SYNC_INTERVAL_MS = 60 * 1000; // 60 seconds
const INITIAL_BACKOFF_MS = 5000;    // 5 seconds
const MAX_BACKOFF_MS = 300 * 1000;  // 5 minutes cap
const BATCH_SIZE = 50;

let syncTimer = null;
let isSyncing = false;
let lastSyncTimestamp = null;
let serverReachable = true;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach(cb => {
    try { cb(); } catch (e) { console.error('Sync listener error:', e); }
  });
}

export function subscribeSyncStatus(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Enqueue a mutation event into the persistent outbox
 */
export async function enqueueOutbox({ entity, entityId, action, payload }) {
  const item = {
    id: crypto.randomUUID(),
    entity,
    entityId,
    action, // 'CREATE' | 'UPDATE' | 'DELETE'
    payload,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(),
    createdAt: new Date().toISOString()
  };

  await db.outbox.put(item);
  notifyListeners();

  // If online, attempt background flush
  if (navigator.onLine && !isSyncing) {
    flushOutbox().catch(err => console.debug('Immediate flush deferred:', err.message));
  }

  return item.id;
}

/**
 * Flush pending outbox operations to the central server
 */
export async function flushOutbox(authToken = null) {
  if (isSyncing || !navigator.onLine) {
    return { synced: 0, pending: await getPendingOutboxCount() };
  }

  isSyncing = true;
  notifyListeners();

  try {
    const now = Date.now();
    const pendingItems = await db.outbox
      .where('status')
      .equals('pending')
      .filter(item => item.nextRetryAt <= now)
      .limit(BATCH_SIZE)
      .toArray();

    if (pendingItems.length === 0) {
      isSyncing = false;
      notifyListeners();
      return { synced: 0, pending: 0 };
    }

    const token = authToken || localStorage.getItem('maternawell_token');

    // Attempt push to backend sync endpoint
    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ items: pendingItems })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      const acceptedIds = new Set(result.acceptedIds || pendingItems.map(p => p.id));

      // Mark outbox records as synced
      await db.transaction('rw', [db.outbox, db.screenings, db.auditLog], async () => {
        for (const item of pendingItems) {
          if (acceptedIds.has(item.id)) {
            await db.outbox.update(item.id, { status: 'synced', syncedAt: new Date().toISOString() });

            // Update underlying entity syncStatus
            if (item.entity === 'screenings') {
              await db.screenings.update(item.entityId, { syncStatus: 'synced' });
            } else if (item.entity === 'auditLog') {
              await db.auditLog.update(item.entityId, { syncStatus: 'synced' });
            }
          }
        }
      });

      lastSyncTimestamp = new Date().toISOString();
      serverReachable = true;
      return { synced: acceptedIds.size, pending: await getPendingOutboxCount() };
    } catch (networkError) {
      serverReachable = false;
      // Quiet debug logging so tests and regular operation are not spammed on every tick
      console.debug('Sync push unreachable, scheduling backoff:', networkError.message);

      await db.transaction('rw', db.outbox, async () => {
        for (const item of pendingItems) {
          const nextRetryCount = (item.retryCount || 0) + 1;
          const backoff = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, nextRetryCount - 1),
            MAX_BACKOFF_MS
          );
          await db.outbox.update(item.id, {
            retryCount: nextRetryCount,
            nextRetryAt: Date.now() + backoff,
            status: nextRetryCount >= 10 ? 'failed' : 'pending',
            lastError: networkError.message
          });
        }
      });

      return { synced: 0, pending: pendingItems.length, error: networkError.message };
    }
  } finally {
    isSyncing = false;
    notifyListeners();
  }
}

/**
 * Pull delta changes from server for the user's facility
 */
export async function pullServerChanges(facilityId, sinceCursor = 0, authToken = null) {
  if (!navigator.onLine || !facilityId) return;

  const token = authToken || localStorage.getItem('maternawell_token');
  try {
    const res = await fetch(`/api/sync/pull?facilityId=${encodeURIComponent(facilityId)}&since=${sinceCursor}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!res.ok) return;

    const data = await res.json();
    if (data.screenings && Array.isArray(data.screenings)) {
      await db.screenings.bulkPut(data.screenings);
    }
    if (data.escalations && Array.isArray(data.escalations)) {
      await db.escalations.bulkPut(data.escalations);
    }
  } catch (e) {
    console.debug('Pull server changes deferred:', e.message);
  }
}

/**
 * Returns total count of pending outbox records
 */
export async function getPendingOutboxCount() {
  try {
    return await db.outbox.where('status').equals('pending').count();
  } catch {
    return 0;
  }
}

export function getLastSyncTime() {
  return lastSyncTimestamp;
}

export function isSyncInProgress() {
  return isSyncing;
}

export function isServerReachable() {
  return serverReachable;
}

/**
 * Initialize automatic sync scheduler and online/offline event listeners
 */
export function initSyncEngine() {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    flushOutbox().catch(() => {});
  };

  window.addEventListener('online', handleOnline);

  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    if (navigator.onLine && !isSyncing) {
      flushOutbox().catch(() => {});
    }
  }, SYNC_INTERVAL_MS);

  // Initial trigger
  if (navigator.onLine) {
    flushOutbox().catch(() => {});
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    if (syncTimer) clearInterval(syncTimer);
  };
}
