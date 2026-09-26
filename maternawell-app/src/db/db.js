import Dexie from 'dexie';
import { decryptData, encryptData, generateDeviceKey } from '../utils/crypto';

/**
 * On-device store (SRS 3.3, FR-8). Only routing metadata (ids, owner, timestamps,
 * status) is stored in clear; every clinical or personal field lives inside an
 * AES-GCM envelope (NFR-8). Data is partitioned by the signed-in staff member
 * because each account's records are encrypted with that account's key.
 */
export const db = new Dexie('MaternawellDB');

db.version(1).stores({
  screenings: 'id, facilityId, workerId, riskTier, hasSelfHarmRisk, status, syncStatus, createdAt, updatedAt',
  drafts: 'id, workerId, facilityId, updatedAt',
  followUps: 'id, screeningId, status, syncStatus, updatedAt',
  escalations: 'id, screeningId, facilityId, status, syncStatus, createdAt',
  auditLog: 'id, timestamp, userId, facilityId, action, entityId, syncStatus',
  outbox: 'id, entity, entityId, action, status, retryCount, nextRetryAt, createdAt',
  users: 'id, staffId, role, facilityId',
  facilities: 'id, name, type, location'
});

// v2 replaces the field-level v1 tables with whole-record envelopes. v1 data came from
// the prototype whose scoring bug stored every screening as 0, so it is not migrated.
db.version(2).stores({
  screenings: null, drafts: null, followUps: null, escalations: null,
  auditLog: null, outbox: null, users: null, facilities: null,
  cases: 'key, ownerId, id, updatedAt',
  caseDrafts: 'key, ownerId, id, updatedAt',
  syncOutbox: 'id, ownerId, entityId, status, nextRetryAt, createdAt',
  auditTrail: 'id, ownerId, timestamp',
  publicOutbox: 'id, createdAt',
  meta: 'key'
});

const LEGACY_LOCAL_STORAGE_KEYS = ['maternawell_screenings', 'maternawell_audit_logs', 'maternawell_active_draft', 'maternawell_user', 'maternawell_token', 'maternawell_migrated_to_dexie', 'maternawell_device_salt'];

/** Removes plaintext health data left in localStorage by earlier prototype builds. */
export function purgeLegacyPlaintext() {
  try { for (const key of LEGACY_LOCAL_STORAGE_KEYS) localStorage.removeItem(key); }
  catch { /* storage unavailable */ }
}

const rowKey = (ownerId, id) => `${ownerId}|${id}`;

// ---- Cases (completed screenings) -------------------------------------------

export async function putCase(ownerId, record, key) {
  await db.cases.put({ key: rowKey(ownerId, record.id), ownerId, id: record.id, updatedAt: record.updatedAt || new Date().toISOString(), envelope: await encryptData(record, key) });
}

export async function getCase(ownerId, id, key) {
  const row = await db.cases.get(rowKey(ownerId, id));
  return row ? decryptData(row.envelope, key) : null;
}

export async function listCases(ownerId, key) {
  const rows = await db.cases.where('ownerId').equals(ownerId).toArray();
  const records = await Promise.all(rows.map(row => decryptData(row.envelope, key).catch(() => null)));
  return records.filter(Boolean).sort((a, b) => String(b.completedAt || b.createdAt).localeCompare(String(a.completedAt || a.createdAt)));
}

export const deleteCase = (ownerId, id) => db.cases.delete(rowKey(ownerId, id));

// ---- Drafts (in-progress screenings, NFR-3) ---------------------------------

export async function putDraft(ownerId, draft, key) {
  await db.caseDrafts.put({ key: rowKey(ownerId, draft.id), ownerId, id: draft.id, updatedAt: new Date().toISOString(), envelope: await encryptData(draft, key) });
}

export async function listDrafts(ownerId, key) {
  const rows = await db.caseDrafts.where('ownerId').equals(ownerId).toArray();
  const drafts = await Promise.all(rows.map(row => decryptData(row.envelope, key).catch(() => null)));
  return drafts.filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export const deleteDraft = (ownerId, id) => db.caseDrafts.delete(rowKey(ownerId, id));

// ---- Outbox (FR-9) -----------------------------------------------------------

export async function enqueueOperation(ownerId, { entity = 'screenings', entityId, action, payload }, key) {
  const item = {
    id: crypto.randomUUID(), ownerId, entity, entityId, action,
    status: 'pending', retryCount: 0, nextRetryAt: Date.now(), createdAt: new Date().toISOString(),
    envelope: await encryptData(payload ?? {}, key)
  };
  await db.syncOutbox.put(item);
  return item;
}

export const outboxFor = ownerId => db.syncOutbox.where('ownerId').equals(ownerId).toArray();

// ---- Audit trail (NFR-7) -------------------------------------------------------

export async function putAudit(ownerId, entry, key) {
  const { details, ...meta } = entry;
  await db.auditTrail.put({ ...meta, ownerId, envelope: await encryptData(details ?? {}, key) });
}

export async function listAudit(ownerId, key, limit = 300) {
  const rows = await db.auditTrail.where('ownerId').equals(ownerId).toArray();
  rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return Promise.all(rows.slice(0, limit).map(async ({ envelope, ...row }) => ({ ...row, details: await decryptData(envelope, key).catch(() => ({})) })));
}

// ---- Meta --------------------------------------------------------------------

export const getMeta = async key => (await db.meta.get(key))?.value;
export const setMeta = (key, value) => db.meta.put({ key, value });

// ---- Anonymous self-referral queue -------------------------------------------

async function deviceKey() {
  let key = await getMeta('deviceKey');
  if (!key) {
    key = await generateDeviceKey();
    await setMeta('deviceKey', key);
  }
  return key;
}

export async function queueSelfReferral(submission) {
  await db.publicOutbox.put({ id: submission.id, createdAt: new Date().toISOString(), attempts: 0, envelope: await encryptData(submission, await deviceKey()) });
}

export async function listQueuedSelfReferrals() {
  const key = await deviceKey();
  const rows = await db.publicOutbox.toArray();
  return Promise.all(rows.map(async row => ({ row, submission: await decryptData(row.envelope, key) })));
}
