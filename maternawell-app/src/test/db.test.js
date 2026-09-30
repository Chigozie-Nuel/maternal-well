import { describe, it, expect, beforeEach } from 'vitest';
import { db, enqueueOperation, listCases, listDrafts, listQueuedSelfReferrals, migrateLegacyForUser, putCase, putDraft, queueSelfReferral } from '../db/db';
import { deriveKey, generateSalt } from '../utils/crypto';
import { scoreEpds } from '../domain/epds';
import Dexie from 'dexie';

const record = {
  id: 'case-1', facilityId: 'phc-ikeja', completedAt: '2026-09-26T09:00:00.000Z',
  motherData: { name: 'Amina Bello', phone: '08011223344', fileNumber: 'IKJ/2026/0412' },
  answers: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 2 }, score: 9, supervisorNotes: 'Called husband'
};

describe('On-device store (FR-8, NFR-8)', () => {
  let key;
  beforeEach(async () => {
    await Promise.all(db.tables.map(table => table.clear()));
    localStorage.clear();
    key = await deriveKey('Worker01!2026', generateSalt());
  });

  it('stores no plaintext personal or clinical data in IndexedDB', async () => {
    await putCase('HW-01', record, key);
    await putDraft('HW-01', { ...record, id: 'draft-1' }, key);
    await enqueueOperation('HW-01', { entityId: 'case-1', action: 'CREATE', payload: record }, key);
    const raw = JSON.stringify([await db.cases.toArray(), await db.caseDrafts.toArray(), await db.syncOutbox.toArray()]);
    for (const secret of ['Amina', '08011223344', 'IKJ/2026/0412', 'Called husband', '"answers"']) expect(raw).not.toContain(secret);
  });

  it('decrypts records for their owner only', async () => {
    await putCase('HW-01', record, key);
    expect((await listCases('HW-01', key))[0].motherData.name).toBe('Amina Bello');
    expect(await listCases('SUP-01', key)).toEqual([]);
    const otherKey = await deriveKey('someone-else', generateSalt());
    await expect(listCases('HW-01', otherKey)).rejects.toThrow(/Decryption failed/);
  });

  it('keeps drafts so an interrupted screening survives a reload (NFR-3)', async () => {
    await putDraft('HW-01', { id: 'd1', answers: { 1: 0, 2: 1 }, currentQuestion: 3, motherData: { name: 'A' } }, key);
    const [draft] = await listDrafts('HW-01', key);
    expect(draft.answers).toEqual({ 1: 0, 2: 1 });
  });

  it('encrypts queued anonymous self-referrals with a device key', async () => {
    await queueSelfReferral({ id: 's1', anonymousCode: 'MW-ABCD-EFGH', motherData: { contactInfo: '0803 555 0101' }, answers: {} });
    expect(JSON.stringify(await db.publicOutbox.toArray())).not.toContain('0803 555 0101');
    const [{ submission }] = await listQueuedSelfReferrals();
    expect(submission.motherData.contactInfo).toBe('0803 555 0101');
  });

  it('imports attributable legacy cases, recomputes their score, and retains unowned data', async () => {
    const legacy = { ...record, workerId: 'HW-01', score: 0, motherData: { ...record.motherData, consentGiven: true }, syncStatus: 'pending' };
    await db.screenings.put(legacy);
    await db.auditLog.put({ id: 'old-audit', userId: 'HW-01', facilityId: 'phc-ikeja', action: 'SCREENING_STARTED', details: { caseId: 'case-1' } });
    localStorage.setItem('maternawell_screenings', JSON.stringify([{ ...legacy, id: 'case-2', workerId: 'HW-02' }]));
    const result = await migrateLegacyForUser({ id: 'HW-01', staffId: 'HW-01', facilityId: 'phc-ikeja' }, 'Worker01!2026', key);
    expect(result.migrated).toBe(2);
    expect((await listCases('HW-01', key))[0].score).toBe(scoreEpds(record.answers));
    expect(await db.screenings.count()).toBe(0);
    expect(await db.auditTrail.count()).toBe(1);
    expect(await db.syncOutbox.count()).toBe(1);
    expect(localStorage.getItem('maternawell_screenings')).toContain('case-2');
  });

  it('keeps version-1 records intact through the schema upgrade', async () => {
    db.close();
    await db.delete();
    const old = new Dexie('MaternawellDB');
    old.version(1).stores({ screenings: 'id, workerId, facilityId' });
    await old.screenings.put({ id: 'old-case', workerId: 'HW-01', facilityId: 'phc-ikeja' });
    old.close();
    await db.open();
    expect(await db.screenings.get('old-case')).toMatchObject({ workerId: 'HW-01' });
  });
});
