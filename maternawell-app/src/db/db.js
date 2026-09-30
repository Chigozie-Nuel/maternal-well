import Dexie from 'dexie';
import { decryptData, deriveKey, encryptData, generateDeviceKey } from '../utils/crypto';
import { scoreEpds, classifyRisk, getReferralPlan, HIGH_RISK_CUTOFF, NIGERIAN_EPDS_CUTOFF } from '../domain/epds';

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

// Retain v1 stores during upgrade. Deleting them before decrypting would permanently
// discard unsynchronized screenings and drafts on existing devices.
db.version(2).stores({
  screenings: 'id, facilityId, workerId, riskTier, hasSelfHarmRisk, status, syncStatus, createdAt, updatedAt',
  drafts: 'id, workerId, facilityId, updatedAt',
  followUps: 'id, screeningId, status, syncStatus, updatedAt',
  escalations: 'id, screeningId, facilityId, status, syncStatus, createdAt',
  auditLog: 'id, timestamp, userId, facilityId, action, entityId, syncStatus',
  outbox: 'id, entity, entityId, action, status, retryCount, nextRetryAt, createdAt',
  users: 'id, staffId, role, facilityId',
  facilities: 'id, name, type, location',
  cases: 'key, ownerId, id, updatedAt',
  caseDrafts: 'key, ownerId, id, updatedAt',
  syncOutbox: 'id, ownerId, entityId, status, nextRetryAt, createdAt',
  auditTrail: 'id, ownerId, timestamp',
  publicOutbox: 'id, createdAt',
  meta: 'key'
});

// Devices already opened with the original v2 schema need the preserved stores
// recreated, while v1 devices retain their existing contents through v2.
db.version(3).stores({
  screenings: 'id, facilityId, workerId, riskTier, hasSelfHarmRisk, status, syncStatus, createdAt, updatedAt',
  drafts: 'id, workerId, facilityId, updatedAt',
  followUps: 'id, screeningId, status, syncStatus, updatedAt',
  escalations: 'id, screeningId, facilityId, status, syncStatus, createdAt',
  auditLog: 'id, timestamp, userId, facilityId, action, entityId, syncStatus',
  outbox: 'id, entity, entityId, action, status, retryCount, nextRetryAt, createdAt',
  users: 'id, staffId, role, facilityId',
  facilities: 'id, name, type, location',
  cases: 'key, ownerId, id, updatedAt',
  caseDrafts: 'key, ownerId, id, updatedAt',
  syncOutbox: 'id, ownerId, entityId, status, nextRetryAt, createdAt',
  auditTrail: 'id, ownerId, timestamp',
  publicOutbox: 'id, createdAt',
  meta: 'key'
});

// Historical localStorage records are processed only after an authenticated owner
// and a decryption key are available. Never delete them merely because the app mounted.

const rowKey = (ownerId, id) => `${ownerId}|${id}`;

async function decryptLegacyValue(value, keys) {
  if (typeof value !== 'string' || !value.startsWith('MW1:')) return value;
  const [, iv, cipher] = value.split(':');
  if (!iv || !cipher) throw new Error('Legacy encrypted field is malformed.');
  const bytes = text => Uint8Array.from(atob(text), character => character.charCodeAt(0));
  for (const key of keys) {
    try {
      const plain = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, key, bytes(cipher)));
      try { return JSON.parse(plain); } catch { return plain; }
    } catch { /* try the next historical key */ }
  }
  throw new Error('A legacy record cannot be decrypted with this account. It has been retained for recovery.');
}

async function decodeLegacyRecord(source, keys) {
  const record = { ...source, motherData: { ...source.motherData } };
  for (const field of ['name', 'phone', 'fileNumber', 'contactInfo']) {
    if (record.motherData[field]) record.motherData[field] = await decryptLegacyValue(record.motherData[field], keys);
  }
  for (const field of ['answers', 'notes', 'supervisorNotes', 'referralNotes']) {
    if (record[field]) record[field] = await decryptLegacyValue(record[field], keys);
  }
  delete record._isEncrypted;
  return record;
}

/** Import only records explicitly owned by this staff member. Ambiguous or
 * undecryptable records remain in their original store for manual recovery. */
export async function migrateLegacyForUser(user, password, key) {
  const keys = [key];
  for (const saltName of [`maternawell_salt_${user.id}`, `maternawell_salt_${user.staffId}`, 'maternawell_device_salt']) {
    const salt = localStorage.getItem(saltName);
    if (salt) {
      try { keys.push(await deriveKey(saltName === 'maternawell_device_salt' ? 'MaternawellSecure2026!' : password, salt)); }
      catch { /* preserve unreadable legacy data */ }
    }
  }
  const ownerMatches = record => String(record.workerId || record.createdBy || '').toUpperCase() === user.id.toUpperCase()
    && (!record.facilityId || record.facilityId === user.facilityId);
  let retained = 0;
  let migrated = 0;
  for (const [tableName, target] of [['screenings', 'case'], ['drafts', 'draft']]) {
    for (const source of await db[tableName].toArray()) {
      if (!ownerMatches(source)) { retained++; continue; }
      try {
        const record = await decodeLegacyRecord(source, keys);
        if (!record.id) throw new Error('Missing legacy record ID.');
        if (target === 'case') {
          const score = scoreEpds(record.answers);
          const hasSelfHarmRisk = Number(record.answers[10]) > 0;
          const plan = getReferralPlan(score, record.answers);
          Object.assign(record, {
            score, riskTier: classifyRisk(score), hasSelfHarmRisk,
            referralPlan: plan, referralActions: plan.actions,
            status: hasSelfHarmRisk || score >= HIGH_RISK_CUTOFF ? 'urgent_referral' : score >= NIGERIAN_EPDS_CUTOFF ? 'referral_needed' : 'completed',
            syncStatus: record.syncStatus === 'synced' ? 'synced' : 'pending'
          });
          await putCase(user.id, record, key);
          if (record.syncStatus !== 'synced' && record.motherData?.consentGiven === true) {
            await enqueueOperation(user.id, { entityId: record.id, action: 'CREATE', payload: record }, key);
          }
        } else await putDraft(user.id, record, key);
        await db[tableName].delete(source.id);
        migrated++;
      } catch { retained++; }
    }
  }
  for (const source of await db.auditLog.toArray()) {
    if (String(source.userId || '').toUpperCase() !== user.id.toUpperCase() || source.facilityId !== user.facilityId) { retained++; continue; }
    try {
      const details = await decryptLegacyValue(source.details || {}, keys);
      await putAudit(user.id, { ...source, details, syncStatus: source.syncStatus || 'local' }, key);
      await db.auditLog.delete(source.id);
      migrated++;
    } catch { retained++; }
  }
  // Historical follow-up, escalation, and outbox shapes vary between releases.
  // Keep them intact for case-by-case recovery rather than dropping clinical data.
  retained += await db.followUps.count() + await db.escalations.count() + await db.outbox.count();
  // The oldest prototype used plaintext localStorage. Import only attributable
  // records and remove each one only after its encrypted copy is durable.
  for (const [storageName, target] of [['maternawell_screenings', 'case'], ['maternawell_active_draft', 'draft']]) {
    const raw = localStorage.getItem(storageName);
    if (!raw) continue;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { retained++; continue; }
    const sources = Array.isArray(parsed) ? parsed : [parsed];
    const remaining = [];
    for (const source of sources) {
      if (!source || !ownerMatches(source)) { remaining.push(source); continue; }
      try {
        const record = await decodeLegacyRecord(source, keys);
        if (!record.id) throw new Error('Missing legacy record ID.');
        if (target === 'case') {
          const score = scoreEpds(record.answers);
          const hasSelfHarmRisk = Number(record.answers[10]) > 0;
          const plan = getReferralPlan(score, record.answers);
          Object.assign(record, { score, riskTier: classifyRisk(score), hasSelfHarmRisk, referralPlan: plan, referralActions: plan.actions,
            status: hasSelfHarmRisk || score >= HIGH_RISK_CUTOFF ? 'urgent_referral' : score >= NIGERIAN_EPDS_CUTOFF ? 'referral_needed' : 'completed' });
          await putCase(user.id, record, key);
          if (record.motherData?.consentGiven === true && record.syncStatus !== 'synced') await enqueueOperation(user.id, { entityId: record.id, action: 'CREATE', payload: record }, key);
        } else await putDraft(user.id, record, key);
        migrated++;
      } catch { remaining.push(source); }
    }
    retained += remaining.length;
    if (!remaining.length) localStorage.removeItem(storageName);
    else localStorage.setItem(storageName, JSON.stringify(Array.isArray(parsed) ? remaining : remaining[0]));
  }
  return { migrated, retained };
}

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
  const records = await Promise.all(rows.map(row => decryptData(row.envelope, key)));
  return records.sort((a, b) => String(b.completedAt || b.createdAt).localeCompare(String(a.completedAt || a.createdAt)));
}

export const deleteCase = (ownerId, id) => db.cases.delete(rowKey(ownerId, id));

// ---- Drafts (in-progress screenings, NFR-3) ---------------------------------

export async function putDraft(ownerId, draft, key) {
  await db.caseDrafts.put({ key: rowKey(ownerId, draft.id), ownerId, id: draft.id, updatedAt: new Date().toISOString(), envelope: await encryptData(draft, key) });
}

export async function listDrafts(ownerId, key) {
  const rows = await db.caseDrafts.where('ownerId').equals(ownerId).toArray();
  const drafts = await Promise.all(rows.map(row => decryptData(row.envelope, key)));
  return drafts.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
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
