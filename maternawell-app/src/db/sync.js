/**
 * Outbox sync engine (SRS FR-9, NFR-2).
 *
 * - Every local write is queued in `syncOutbox` (encrypted) before anything touches the network.
 * - Flushes on start-up, on the browser `online` event and every 30 s while online.
 * - Batches of at most 50 gzip-compressed operations; the server applies each operation
 *   idempotently, so a retried batch never creates duplicates.
 * - Network/server failures back off exponentially (5 s doubling to a 5 min cap) and keep
 *   the operation pending. Validation rejections are marked `failed` and shown to the user.
 * - After pushing, pulls the facility's changes since the last cursor. Records with local
 *   operations still queued are not overwritten, so offline edits are never lost.
 */
import { apiRequest, ApiError, NetworkError } from '../config/api';
import { db, deleteCase, getMeta, listQueuedSelfReferrals, putAudit, putCase, setMeta } from './db';
import { decryptData } from '../utils/crypto';

export const SYNC_INTERVAL_MS = 30 * 1000;
export const INITIAL_BACKOFF_MS = 5000;
export const MAX_BACKOFF_MS = 5 * 60 * 1000;
export const BATCH_SIZE = 50;

export const backoffFor = retryCount => Math.min(INITIAL_BACKOFF_MS * 2 ** Math.max(0, retryCount - 1), MAX_BACKOFF_MS);

const state = { running: false, serverReachable: null, lastSyncAt: null, lastError: null, authExpired: false };
const listeners = new Set();
const notify = () => listeners.forEach(listener => { try { listener({ ...state }); } catch { /* ignore */ } });

export const subscribeSync = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getSyncState = () => ({ ...state });
export const markAuthRestored = () => { state.authExpired = false; notify(); };

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

async function pushOutbox({ ownerId, token, key, role }) {
  if (role === 'admin') return { pushed: 0 };
  const now = Date.now();
  const due = (await db.syncOutbox.where('ownerId').equals(ownerId).toArray())
    .filter(item => item.status === 'pending' && item.nextRetryAt <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, BATCH_SIZE);
  if (!due.length) return { pushed: 0 };

  const items = await Promise.all(due.map(async item => ({
    id: item.id, entity: item.entity, entityId: item.entityId, action: item.action,
    payload: await decryptData(item.envelope, key)
  })));

  let result;
  try {
    result = await apiRequest('/api/sync/push', { token, body: { items }, compress: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      state.authExpired = true;
      throw error;
    }
    await db.transaction('rw', db.syncOutbox, async () => {
      for (const item of due) {
        const retryCount = item.retryCount + 1;
        await db.syncOutbox.update(item.id, { retryCount, nextRetryAt: Date.now() + backoffFor(retryCount), lastError: error.message });
      }
    });
    throw error;
  }

  const accepted = new Set(result.acceptedIds || []);
  const rejected = new Map((result.rejectedItems || []).map(item => [item.id, item]));
  await db.transaction('rw', db.syncOutbox, async () => {
    for (const item of due) {
      if (accepted.has(item.id)) await db.syncOutbox.delete(item.id);
      else if (rejected.has(item.id)) {
        const { status, error } = rejected.get(item.id);
        // 5xx is transient; anything else is a permanent validation/permission rejection.
        if (status >= 500) {
          const retryCount = item.retryCount + 1;
          await db.syncOutbox.update(item.id, { retryCount, nextRetryAt: Date.now() + backoffFor(retryCount), lastError: error });
        } else {
          await db.syncOutbox.update(item.id, { status: 'failed', lastError: error, failedAt: new Date().toISOString() });
        }
      }
    }
  });
  return { pushed: accepted.size, rejected: rejected.size };
}

async function pullChanges({ ownerId, token, key }) {
  const cursorKey = `cursor:${ownerId}`;
  const since = (await getMeta(cursorKey)) || 0;
  const data = await apiRequest(`/api/sync/pull?since=${since}`, { token });
  const queued = new Set((await db.syncOutbox.where('ownerId').equals(ownerId).toArray()).map(item => item.entityId));
  for (const record of data.screenings || []) {
    if (queued.has(record.id)) continue;
    if (record.deletedAt) await deleteCase(ownerId, record.id);
    else await putCase(ownerId, { ...record, syncStatus: 'synced' }, key);
  }
  for (const entry of data.auditLogs || []) {
    await putAudit(ownerId, { ...entry, syncStatus: 'synced', source: 'server' }, key);
  }
  await setMeta(cursorKey, data.cursor ?? since);
  return { pulled: (data.screenings || []).length };
}

/** Anonymous self-referrals saved while offline; no staff session is needed to send them. */
export async function flushSelfReferrals() {
  if (!isOnline()) return 0;
  let sent = 0;
  for (const { row, submission } of await listQueuedSelfReferrals()) {
    try {
      await apiRequest('/api/self-referral', { body: submission });
      await db.publicOutbox.delete(row.id);
      sent++;
    } catch (error) {
      if (error instanceof NetworkError || (error instanceof ApiError && (error.status >= 500 || error.status === 429))) break;
      // Permanent rejection: keep it for inspection but stop retrying.
      await db.publicOutbox.update(row.id, { failed: true, lastError: error.message });
    }
  }
  return sent;
}

/**
 * Runs one push + pull cycle for the signed-in account. `context` is
 * { ownerId, token, key, role }. Resolves with a summary; never throws.
 */
export async function syncNow(context) {
  if (state.running) return { skipped: true };
  if (!isOnline()) {
    state.serverReachable = false;
    notify();
    return { offline: true };
  }
  state.running = true;
  notify();
  const summary = {};
  try {
    await flushSelfReferrals().catch(() => 0);
    if (context?.ownerId && context.key && context.token && !state.authExpired) {
      Object.assign(summary, await pushOutbox(context));
      Object.assign(summary, await pullChanges(context));
    }
    state.serverReachable = true;
    state.lastSyncAt = new Date().toISOString();
    state.lastError = null;
  } catch (error) {
    state.serverReachable = !(error instanceof NetworkError);
    state.lastError = error.message;
    summary.error = error.message;
  } finally {
    state.running = false;
    notify();
  }
  return summary;
}

export async function outboxSummary(ownerId) {
  const items = ownerId ? await db.syncOutbox.where('ownerId').equals(ownerId).toArray() : [];
  const queuedSelfReferrals = await db.publicOutbox.count();
  return {
    pending: items.filter(item => item.status === 'pending').length,
    failed: items.filter(item => item.status === 'failed'),
    queuedSelfReferrals
  };
}

/** Starts periodic sync; returns a stop function. */
export function startSyncScheduler(getContext) {
  const run = () => syncNow(getContext());
  const onOnline = () => run();
  window.addEventListener('online', onOnline);
  const timer = setInterval(() => { if (isOnline()) run(); }, SYNC_INTERVAL_MS);
  run();
  return () => {
    clearInterval(timer);
    window.removeEventListener('online', onOnline);
  };
}

/** Puts rejected operations back in the queue (e.g. after the cause was fixed on the server). */
export async function retryFailed(ownerId) {
  const failed = (await db.syncOutbox.where('ownerId').equals(ownerId).toArray()).filter(item => item.status === 'failed');
  await Promise.all(failed.map(item => db.syncOutbox.update(item.id, { status: 'pending', retryCount: 0, nextRetryAt: Date.now() })));
  return failed.length;
}
