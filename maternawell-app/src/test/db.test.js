import { describe, it, expect, beforeEach } from 'vitest';
import { db, enqueueOperation, listCases, listDrafts, listQueuedSelfReferrals, purgeLegacyPlaintext, putCase, putDraft, queueSelfReferral } from '../db/db';
import { deriveKey, generateSalt } from '../utils/crypto';

const record = {
  id: 'case-1', facilityId: 'phc-ikeja', completedAt: '2026-09-26T09:00:00.000Z',
  motherData: { name: 'Amina Bello', phone: '08011223344', fileNumber: 'IKJ/2026/0412' },
  answers: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 2 }, score: 9, supervisorNotes: 'Called husband'
};

describe('On-device store (FR-8, NFR-8)', () => {
  let key;
  beforeEach(async () => {
    await Promise.all(db.tables.map(table => table.clear()));
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
    expect(await listCases('HW-01', otherKey)).toEqual([]);
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

  it('removes plaintext left in localStorage by earlier builds', () => {
    localStorage.setItem('maternawell_screenings', '[{"motherName":"Old"}]');
    purgeLegacyPlaintext();
    expect(localStorage.getItem('maternawell_screenings')).toBeNull();
  });
});
